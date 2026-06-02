const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');

const TEST_USER = {
  accountId: 'auth_test_user',
  password: 'Password123!',
  email: 'auth_test@test.com',
};

afterEach(async () => {
  await db.pool.query("DELETE FROM users WHERE account_id LIKE 'auth_test_%'");
});

afterAll(async () => {
  await db.pool.end();
});

describe('POST /api/users/register', () => {
  test('valid fields: 201, token in body, refreshToken cookie set', async () => {
    const res = await request(app).post('/api/users/register').send(TEST_USER);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken')])
    );
  });

  test('duplicate email: 400', async () => {
    await request(app).post('/api/users/register').send(TEST_USER);
    const res = await request(app)
      .post('/api/users/register')
      .send({ ...TEST_USER, accountId: 'auth_test_user2' });
    expect(res.status).toBe(400);
  });

  test('missing fields: 400', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ accountId: 'auth_test_user3' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/users/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/users/register').send(TEST_USER);
  });

  test('correct credentials: 200, token in body', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ accountId: TEST_USER.accountId, password: TEST_USER.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('wrong password: 401', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ accountId: TEST_USER.accountId, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/details', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/users/register').send(TEST_USER);
    token = res.body.token;
  });

  test('without token: 401', async () => {
    const res = await request(app).get('/api/users/details');
    expect(res.status).toBe(401);
  });

  test('with valid token: 200, correct user shape', async () => {
    const res = await request(app)
      .get('/api/users/details')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accountId: TEST_USER.accountId,
      email: TEST_USER.email,
    });
    expect(res.body).toHaveProperty('joinedDate');
  });
});

describe('POST /api/users/refresh', () => {
  test('valid refresh cookie: 200, new token', async () => {
    const registerRes = await request(app).post('/api/users/register').send(TEST_USER);
    const cookieHeader = registerRes.headers['set-cookie'];
    const res = await request(app)
      .post('/api/users/refresh')
      .set('Cookie', cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

describe('PATCH /api/users/password', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/users/register').send(TEST_USER);
    token = res.body.token;
  });

  test('wrong old password: 401', async () => {
    const res = await request(app)
      .patch('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'wrongpassword', newPassword: 'NewPassword123!' });
    expect(res.status).toBe(401);
  });

  test('success: 200', async () => {
    const res = await request(app)
      .patch('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: TEST_USER.password, newPassword: 'NewPassword123!' });
    expect(res.status).toBe(200);
  });
});

describe('Full auth flow', () => {
  test('register → login → refresh → change password → login with new password: 200', async () => {
    const registerRes = await request(app).post('/api/users/register').send(TEST_USER);
    expect(registerRes.status).toBe(201);
    const token = registerRes.body.token;
    const cookieHeader = registerRes.headers['set-cookie'];

    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ accountId: TEST_USER.accountId, password: TEST_USER.password });
    expect(loginRes.status).toBe(200);

    const refreshRes = await request(app)
      .post('/api/users/refresh')
      .set('Cookie', cookieHeader);
    expect(refreshRes.status).toBe(200);

    const changeRes = await request(app)
      .patch('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: TEST_USER.password, newPassword: 'NewPassword456!' });
    expect(changeRes.status).toBe(200);

    const newLoginRes = await request(app)
      .post('/api/users/login')
      .send({ accountId: TEST_USER.accountId, password: 'NewPassword456!' });
    expect(newLoginRes.status).toBe(200);
  });
});
