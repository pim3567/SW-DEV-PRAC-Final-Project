const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Reservation = require('../models/Reservation');
const MassageShop = require('../models/MassageShop');
const { getMyReservations, createReservation, updateReservation, deleteReservation } = require('../controllers/reservation');

process.env.JWT_SECRET = 'reservation-test-secret';

describe('Create reservations', () => {
    const userId = '507f1f77bcf86cd799439012';
    const shopId = '507f1f77bcf86cd799439013';
    let rows;
    let lockTail;

    beforeEach(() => {
        rows = [];
        lockTail = Promise.resolve();
        jest.spyOn(MassageShop, 'findById').mockResolvedValue({
            _id: shopId, openingTime: '09:00', closingTime: '21:00'
        });

        // In-memory transaction boundary: stage writes until commit and release locks on abort.
        jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async callback => {
            const session = { pending: [], locked: false };
            try {
                const result = await callback(session);
                rows.push(...session.pending);
                return result;
            } finally {
                if (session.release) session.release();
            }
        });
        jest.spyOn(User, 'updateOne').mockImplementation(async (filter, update, options) => {
            expect(filter).toEqual({ _id: userId });
            expect(update).toEqual({ $inc: { reservationVersion: 1 } });
            const session = options.session;
            const previous = lockTail;
            lockTail = new Promise(resolve => { session.release = resolve; });
            await previous;
            session.locked = true;
            return { matchedCount: 1 };
        });
        jest.spyOn(Reservation, 'countDocuments').mockImplementation(filter => {
            const count = () => rows.filter(row =>
                row.userId === filter.userId && filter.status.$in.includes(row.status)
            ).length;
            return {
                then(resolve, reject) { return Promise.resolve(count()).then(resolve, reject); },
                session(session) {
                    expect(session.locked).toBe(true);
                    return Promise.resolve(count());
                }
            };
        });
        jest.spyOn(Reservation, 'create').mockImplementation(async (input, options) => {
            const data = Array.isArray(input) ? input : [input];
            const documents = data.map(row => new Reservation(row));
            await Promise.all(documents.map(doc => doc.validate()));
            if (options?.session) {
                expect(options.session.locked).toBe(true);
                options.session.pending.push(...data);
            } else {
                rows.push(...data);
            }
            return Array.isArray(input) ? documents : documents[0];
        });
    });

    afterEach(() => jest.restoreAllMocks());

    async function book(overrides = {}) {
        const res = {
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; }
        };
        await createReservation({
            user: { id: userId },
            body: { shopId, reservationDate: '2099-12-01', startTime: '14:00', ...overrides }
        }, res);
        return res;
    }

    test.each(['2099-02-30', '2099-04-31', '2099-02-29'])(
        'rejects nonexistent calendar date %s before writing', async reservationDate => {
            const res = await book({ reservationDate });
            expect(res.statusCode).toBe(400);
            expect(rows).toHaveLength(0);
        }
    );

    test('accepts a real leap day and sets the authenticated owner and pending status', async () => {
        const res = await book({ reservationDate: '2096-02-29', userId: shopId, status: 'completed' });
        expect(res.statusCode).toBe(201);
        expect(res.body.data.reservationDate.toISOString()).toBe('2096-02-29T07:00:00.000Z');
        expect(rows[0].userId).toBe(userId);
        expect(rows[0].status).toBe('pending');
    });

    test('only one of two concurrent requests can take the third active reservation', async () => {
        rows.push({ userId, status: 'pending' }, { userId, status: 'confirmed' });
        const results = await Promise.all([book(), book()]);
        expect(results.map(res => res.statusCode).sort()).toEqual([201, 400]);
        expect(rows).toHaveLength(3);
    });

    test('completed and cancelled reservations do not consume active places', async () => {
        rows.push({ userId, status: 'completed' }, { userId, status: 'cancelled' });
        expect((await book()).statusCode).toBe(201);
    });

    test('a failed creation releases the transaction lock and allows a later booking', async () => {
        Reservation.create.mockRejectedValueOnce(Object.assign(new Error('Invalid data'), {
            name: 'ValidationError'
        }));
        expect((await book()).statusCode).toBe(400);
        expect(rows).toHaveLength(0);
        expect((await book()).statusCode).toBe(201);
    });

    test.each(['multipart', 'json'])('creates reservations from %s fields', async format => {
        jest.spyOn(User, 'findById').mockResolvedValue({ id: userId, role: 'user' });
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
        const fields = { shopId, reservationDate: '2099-12-01', startTime: '14:00' };
        const req = request(require('../app')).post('/api/v1/reservations')
            .set('Authorization', `Bearer ${token}`);
        const res = await (format === 'multipart' ? req.field(fields) : req.send(fields));
        expect(res.status).toBe(201);
        expect(res.body.data.startTime).toBe('14:00');
        expect(rows).toHaveLength(1);
    });

    test('rejects malformed multipart input with a JSON error', async () => {
        jest.spyOn(User, 'findById').mockResolvedValue({ id: userId, role: 'user' });
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
        const res = await request(require('../app')).post('/api/v1/reservations')
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'multipart/form-data')
            .send('missing boundary');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Invalid multipart form data');
        expect(rows).toHaveLength(0);
    });
});

describe('View, edit, and delete reservations', () => {
    const reservationId = '507f1f77bcf86cd799439011';
    const userId = '507f1f77bcf86cd799439012';
    const shopId = '507f1f77bcf86cd799439013';
    const otherShopId = '507f1f77bcf86cd799439014';
    let reservation;
    let persisted;

    beforeEach(() => {
        reservation = {
            _id: reservationId,
            userId,
            shopId,
            reservationDate: new Date('2099-12-01T07:00:00Z'),
            startTime: '14:00',
            status: 'pending'
        };
        persisted = null;
        jest.spyOn(Reservation, 'findById').mockImplementation(async () => ({ ...reservation }));
        jest.spyOn(MassageShop, 'findById').mockResolvedValue({
            _id: shopId, openingTime: '09:00', closingTime: '21:00'
        });
        jest.spyOn(Reservation, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
            if (filter._id !== reservation._id || (filter.userId && filter.userId !== reservation.userId)) {
                return null;
            }
            persisted = { ...reservation, ...update.$set };
            return persisted;
        });
        // Keep the old implementation from reaching a real database during RED.
        jest.spyOn(Reservation, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
            persisted = { ...reservation, ...update };
            return persisted;
        });
    });

    afterEach(() => jest.restoreAllMocks());

    async function edit(body, options = {}) {
        const res = {
            status(code) { this.statusCode = code; return this; },
            json(data) { this.body = data; return this; }
        };
        await updateReservation({
            params: { id: options.id || reservationId },
            user: { id: options.userId || userId, role: options.role || 'user' },
            body
        }, res);
        return res;
    }

    test('reservation routes load through the app', () => {
        expect(() => require('../app')).not.toThrow();
    });

    test.each([
        ['owner', userId, 'user', 200],
        ['another user', otherShopId, 'user', 403],
        ['admin', otherShopId, 'admin', 200]
    ])('get one reservation as %s enforces access', async (label, requesterId, role, status) => {
        jest.spyOn(User, 'findById').mockResolvedValue({ id: requesterId, role });
        const token = jwt.sign({ id: requesterId }, process.env.JWT_SECRET);
        const details = {
            ...reservation,
            shopId: { _id: shopId, name: 'Test Shop', openingTime: '09:00', closingTime: '21:00' },
            userId: { _id: userId, name: 'Test User', email: 'test@example.com' }
        };
        Reservation.findById.mockResolvedValue({
            ...reservation,
            populate: jest.fn().mockResolvedValue(details)
        });
        const res = await request(require('../app')).get(`/api/v1/reservations/${reservationId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(status);
        if (status === 200) {
            expect(res.body.data._id).toBe(reservationId);
            expect(res.body.data.shopId.name).toBe('Test Shop');
            expect(res.body.data.userId._id).toBe(userId);
        } else {
            expect(res.body.data).toBeUndefined();
        }
    });

    test.each([
        ['bad-id', 400],
        ['000000', 400],
        [reservationId, 404]
    ])('get one rejects invalid or missing reservation %s with %i', async (id, status) => {
        jest.spyOn(User, 'findById').mockResolvedValue({ id: userId, role: 'user' });
        Reservation.findById.mockResolvedValue(null);
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
        const res = await request(require('../app')).get(`/api/v1/reservations/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(status);
    });

    test('get one requires login', async () => {
        const res = await request(require('../app')).get(`/api/v1/reservations/${reservationId}`);
        expect(res.status).toBe(401);
    });

    test('owners can change time without changing the Thailand booking day', async () => {
        const res = await edit({ startTime: '15:00' });
        expect(res.statusCode).toBe(200);
        expect(res.body.data.reservationDate).toEqual(new Date('2099-12-01T08:00:00Z'));
        expect(res.body.data.startTime).toBe('15:00');
    });

    test('owners can update all booking fields using multipart', async () => {
        jest.spyOn(User, 'findById').mockResolvedValue({ id: userId, role: 'user' });
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
        const res = await request(require('../app')).put(`/api/v1/reservations/${reservationId}`)
            .set('Authorization', `Bearer ${token}`)
            .field('shopId', shopId)
            .field('reservationDate', '2099-12-02')
            .field('startTime', '15:00');
        expect(res.status).toBe(200);
        expect(res.body.data.startTime).toBe('15:00');
        expect(res.body.data.reservationDate).toBe('2099-12-02T08:00:00.000Z');
    });

    test('date-only changes preserve the existing local time', async () => {
        const res = await edit({ reservationDate: '2099-12-02' });
        expect(res.statusCode).toBe(200);
        expect(res.body.data.reservationDate).toEqual(new Date('2099-12-02T07:00:00Z'));
        expect(res.body.data.startTime).toBe('14:00');
    });

    test('time-only changes handle UTC dates that fall on the previous day', async () => {
        reservation.reservationDate = new Date('2099-11-30T17:30:00Z');
        reservation.startTime = '00:30';
        const res = await edit({ startTime: '10:00' });
        expect(res.statusCode).toBe(200);
        expect(res.body.data.reservationDate).toEqual(new Date('2099-12-01T03:00:00Z'));
    });

    test('cannot transfer ownership or change status through the edit body', async () => {
        const res = await edit({ startTime: '15:00', userId: otherShopId, status: 'completed' });
        expect(res.statusCode).toBe(200);
        expect(res.body.data.userId).toBe(userId);
        expect(res.body.data.status).toBe('pending');
    });

    test('cannot edit another user reservation', async () => {
        const res = await edit({ startTime: '15:00' }, { userId: otherShopId });
        expect(res.statusCode).toBe(403);
        expect(persisted).toBeNull();
    });

    test('admins can edit another user reservation without changing its owner', async () => {
        const res = await edit({ startTime: '15:00', userId: otherShopId, status: 'completed' }, {
            userId: otherShopId, role: 'admin'
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.data.userId).toBe(userId);
        expect(res.body.data.status).toBe('pending');
        expect(res.body.data.startTime).toBe('15:00');
    });

    test.each(['user', 'admin'])('%s reservation listing applies the correct visibility', async (role) => {
        const rows = [reservation, { ...reservation, _id: otherShopId, userId: otherShopId }];
        jest.spyOn(Reservation, 'find').mockImplementation(filter => {
            const query = {
                populate() { return query; },
                async sort() { return rows.filter(row => !filter.userId || row.userId === filter.userId); }
            };
            return query;
        });
        const res = {
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; }
        };
        await getMyReservations({ user: { id: userId, role } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.count).toBe(role === 'admin' ? 2 : 1);
        if (role === 'user') {
            expect(res.body.data.every(row => row.userId === userId)).toBe(true);
        }
    });

    test.each([
        ['user', userId, 200],
        ['user', otherShopId, 403],
        ['admin', otherShopId, 200]
    ])('%s deleting as %s returns %i', async (role, requesterId, expectedStatus) => {
        let deleted = false;
        jest.spyOn(Reservation, 'findOneAndDelete').mockImplementation(async filter => {
            if (filter._id !== reservation._id || (filter.userId && filter.userId !== reservation.userId)) {
                return null;
            }
            deleted = true;
            return reservation;
        });
        const res = {
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; }
        };
        await deleteReservation({
            params: { id: reservationId }, user: { id: requesterId, role }
        }, res);
        expect(res.statusCode).toBe(expectedStatus);
        expect(deleted).toBe(expectedStatus === 200);
    });

    test('returns 404 for a missing reservation', async () => {
        Reservation.findById.mockResolvedValue(null);
        expect((await edit({ startTime: '15:00' })).statusCode).toBe(404);
    });

    test('returns 404 for a missing destination shop', async () => {
        MassageShop.findById.mockResolvedValue(null);
        expect((await edit({ shopId: otherShopId })).statusCode).toBe(404);
        expect(persisted).toBeNull();
    });

    test.each([
        { reservationDate: '2099-02-30' },
        { reservationDate: '2000-01-01' },
        { reservationDate: null },
        { startTime: '22:00' },
        { startTime: '21:00' },
        { startTime: '' },
        { startTime: ['15:00'] },
        { shopId: 'invalid' },
        {},
        { status: 'completed' },
        null
    ])('rejects invalid booking changes %p without saving', async (body) => {
        const res = await edit(body);
        expect(res.statusCode).toBe(400);
        expect(persisted).toBeNull();
    });

    test('rejects malformed reservation IDs with 400', async () => {
        expect((await edit({ startTime: '15:00' }, { id: 'bad-id' })).statusCode).toBe(400);
    });

    test('returns 400 for database validation errors', async () => {
        const error = Object.assign(new Error('Invalid data'), { name: 'ValidationError' });
        Reservation.findOneAndUpdate.mockRejectedValue(error);
        Reservation.findByIdAndUpdate.mockRejectedValue(error);
        expect((await edit({ startTime: '15:00' })).statusCode).toBe(400);
    });
});
