const Rating = require('../models/Rating');
const Reservation = require('../models/Reservation');
const { createRating, getRatings } = require('../controllers/ratings');

const makeResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
});

const userId = '507f1f77bcf86cd799439011';
const reservationId = '507f1f77bcf86cd799439012';
const shopId = '507f1f77bcf86cd799439013';
const past = () => ({
    _id: reservationId, userId, shopId, status: 'completed',
    reservationDate: new Date('2020-01-01T03:00:00Z')
});
const call = async (body, reservation = past(), id = reservationId) => {
    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    const res = makeResponse();
    await createRating({ params: { id }, user: { id: userId }, body }, res);
    return res;
};

afterEach(() => jest.restoreAllMocks());

test('owner can rate a completed reservation', async () => {
    const doc = { rating: 5 };
    jest.spyOn(Rating, 'create').mockResolvedValue(doc);
    const res = await call({ rating: 5, comment: 'Great' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Rating.create).toHaveBeenCalledWith(expect.objectContaining({ shopId, userId, rating: 5 }));
});

test.each([0, 6, 3.5, '4', null, undefined])('rejects rating %p', async (rating) => {
    const res = await call({ rating });
    expect(res.status).toHaveBeenCalledWith(400);
});

test('rejects confirmed, cancelled, and others\' reservations', async () => {
    expect((await call({ rating: 4 }, { ...past(), status: 'confirmed' })).status).toHaveBeenCalledWith(400);
    expect((await call({ rating: 4 }, { ...past(), status: 'cancelled' })).status).toHaveBeenCalledWith(400);
    expect((await call({ rating: 4 }, { ...past(), userId: 'other' })).status).toHaveBeenCalledWith(404);
    expect((await call({ rating: 4 }, null)).status).toHaveBeenCalledWith(404);
});

test('does not apply time-based validation to a completed reservation', async () => {
    jest.spyOn(Rating, 'create').mockResolvedValue({ rating: 4 });
    const future = { ...past(), reservationDate: new Date('2099-01-01T03:00:00Z') };
    expect((await call({ rating: 4 }, future)).status).toHaveBeenCalledWith(201);
});

test('duplicate rating returns 400', async () => {
    jest.spyOn(Rating, 'create').mockRejectedValue({ code: 11000 });
    expect((await call({ rating: 4 })).status).toHaveBeenCalledWith(400);
});

test('lists all ratings', async () => {
    const docs = [{ rating: 5 }];
    const sort = jest.fn().mockResolvedValue(docs);
    const q = { populate: jest.fn().mockReturnThis(), sort };
    jest.spyOn(Rating, 'find').mockReturnValue(q);
    const res = makeResponse();
    await getRatings({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, count: 1, data: docs });
});

test('rejects invalid shopId filter', async () => {
    const res = makeResponse();
    await getRatings({ query: { shopId: 'bad' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
});
