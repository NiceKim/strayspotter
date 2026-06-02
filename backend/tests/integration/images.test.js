const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');

jest.mock('../../src/services/s3Service');
const s3Service = require('../../src/services/s3Service');

beforeEach(async () => {
  s3Service.getPresignedUrl.mockResolvedValue('https://mock-s3.com/image.jpg');
  await db.pool.query(
    "INSERT INTO pictures (picture_key, cat_status) VALUES ('test_img_key_1', 0)"
  );
  const [[picture]] = await db.pool.query(
    "SELECT id FROM pictures WHERE picture_key = 'test_img_key_1'"
  );
  await db.pool.query(
    'INSERT INTO posts (picture_id, user_id) VALUES (?, NULL)',
    [picture.id]
  );
});

afterEach(async () => {
  await db.pool.query("DELETE FROM pictures WHERE picture_key LIKE 'test_img_%'");
});

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/images', () => {
  test('200, array of posts', async () => {
    const res = await request(app).get('/api/images');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('maxKeys=1: returns at most 1 result', async () => {
    const res = await request(app).get('/api/images?maxKeys=1&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(1);
  });
});

describe('GET /api/image-url', () => {
  test('without key: 400', async () => {
    const res = await request(app).get('/api/image-url');
    expect(res.status).toBe(400);
  });

  test('with key: 200, url in body', async () => {
    const res = await request(app).get('/api/image-url?key=test_img_key_1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
  });
});
