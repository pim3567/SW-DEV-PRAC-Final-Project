process.env.JWT_SECRET = 'testsecret';
process.env.JWT_EXPIRE = '30d';
process.env.JWT_COOKIE_EXPIRE = '30';

jest.mock('../models/User');

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
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^token=none/);
  });
});
