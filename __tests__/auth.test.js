process.env.JWT_SECRET = 'testsecret';
process.env.JWT_EXPIRE = '30d';
process.env.JWT_COOKIE_EXPIRE = '30';

jest.mock('../models/User');
jest.mock('../utils/welcomeEmail', () => ({ sendWelcomeEmail: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const app = require('../app');

const makeUser = (overrides = {}) => ({
  _id: 'u1',
  name: 'Test',
  tel: '0812345678',
  email: 'test@example.com',
  role: 'user',
  getSignedJwtToken: () => jwt.sign({ id: 'u1' }, process.env.JWT_SECRET),
  matchPassword: jest.fn().mockResolvedValue(true),
  ...overrides,
});

beforeEach(() => jest.resetAllMocks());

describe('POST /api/v1/auth/register', () => {
  const body = { name: 'Test', tel: '0812345678', email: 'test@example.com', password: '123456' };

  test('registers a user with tel and returns a token', async () => {
    User.create.mockResolvedValue(makeUser());
    const res = await request(app).post('/api/v1/auth/register').send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tel).toBe(body.tel);
    expect(res.body.token).toBeDefined();
    expect(res.body.password).toBeUndefined();
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ tel: body.tel }));
    expect(require('../utils/welcomeEmail').sendWelcomeEmail).toHaveBeenCalled();
  });

  test('returns 400 when creation fails (e.g. missing tel)', async () => {
    User.create.mockRejectedValue(new Error('Please add a telephone number'));
    const res = await request(app).post('/api/v1/auth/register').send({ ...body, tel: undefined });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/v1/auth/login', () => {
  const findOneReturning = (value) => User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(value) });

  test('400 when email or password missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  test('401 when user not found', async () => {
    findOneReturning(null);
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  test('401 when password does not match', async () => {
    findOneReturning(makeUser({ matchPassword: jest.fn().mockResolvedValue(false) }));
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'bad' });
    expect(res.status).toBe(401);
  });

  test('200 with token and cookie on success', async () => {
    findOneReturning(makeUser());
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'test@example.com', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^token=/);
  });
});

describe('GET /api/v1/auth/logout', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });

  test('clears the cookie when logged in', async () => {
    User.findById.mockResolvedValue(makeUser());
    User.updateOne.mockResolvedValue({ matchedCount: 1 });
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^token=none/);
  });

  test('revokes existing tokens across devices and allows a fresh login', async () => {
    const user = makeUser({ id: 'u1', tokenVersion: 0 });
    user.getSignedJwtToken = () => jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET);
    User.findById.mockImplementation(async () => user);
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    User.updateOne.mockImplementation(async () => {
      user.tokenVersion += 1;
      return { matchedCount: 1 };
    });
    const token = user.getSignedJwtToken();
    const otherDeviceToken = jwt.sign({ id: user.id, tokenVersion: 0, jti: 'other-device' }, process.env.JWT_SECRET);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);

    const logout = await request(app).get('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);
    expect(User.updateOne).toHaveBeenCalledWith({ _id: user.id }, { $inc: { tokenVersion: 1 } });
    for (const oldToken of [token, otherDeviceToken]) {
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401);
    }
    expect((await request(app).post('/api/v1/reservations').set('Authorization', `Bearer ${token}`).send({})).status).toBe(401);

    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: '123456' });
    expect(login.status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.token}`)).status).toBe(200);
  });

  test('does not report success if token revocation fails', async () => {
    User.findById.mockResolvedValue(makeUser({ id: 'u1' }));
    User.updateOne.mockRejectedValue(new Error('Database unavailable'));
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
