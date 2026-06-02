const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');

let pictureId;

beforeEach(async () => {
  const [result] = await db.pool.query(
    'INSERT INTO pictures (picture_key, cat_status, date_taken, latitude, longitude, district_no) VALUES (?, ?, ?, ?, ?, ?)',
    ['test_pic_report_1', 0, new Date('2025-01-15'), 1.3521, 103.8198, 1]
  );
  pictureId = result.insertId;
});

afterEach(async () => {
  await db.pool.query("DELETE FROM pictures WHERE picture_key LIKE 'test_pic_report_%'");
});

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/pictures/reports', () => {
  test('without timeFrame: 400', async () => {
    const res = await request(app).get('/api/pictures/reports');
    expect(res.status).toBe(400);
  });

  test('daily without date range: 400', async () => {
    const res = await request(app).get('/api/pictures/reports?timeFrame=daily');
    expect(res.status).toBe(400);
  });

  test('monthly without month: 400', async () => {
    const res = await request(app).get('/api/pictures/reports?timeFrame=monthly');
    expect(res.status).toBe(400);
  });

  test('monthly with valid month: 200', async () => {
    const res = await request(app).get('/api/pictures/reports?timeFrame=monthly&month=2025-01');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/pictures/counts', () => {
  test('200, day/week/month shape', async () => {
    const res = await request(app).get('/api/pictures/counts');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      day: expect.any(Number),
      week: expect.any(Number),
      month: expect.any(Number),
    });
  });
});

describe('GET /api/pictures/:id/gps', () => {
  test('non-numeric id: 400', async () => {
    const res = await request(app).get('/api/pictures/abc/gps');
    expect(res.status).toBe(400);
  });

  test('valid id: 200, latitude and longitude', async () => {
    const res = await request(app).get(`/api/pictures/${pictureId}/gps`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      latitude: expect.any(Number),
      longitude: expect.any(Number),
    });
  });
});
