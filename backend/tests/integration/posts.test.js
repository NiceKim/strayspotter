const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');

jest.mock('../../src/services/image_handler');
jest.mock('../../src/services/s3Service');

const { processImageUpload } = require('../../src/services/image_handler');
const s3Service = require('../../src/services/s3Service');

const USER1 = { accountId: 'posts_test_u1', password: 'Password123!', email: 'posts_test1@test.com' };
const USER2 = { accountId: 'posts_test_u2', password: 'Password123!', email: 'posts_test2@test.com' };

const FAKE_FILE = Buffer.from('fake image');
const FILE_OPTS = { filename: 'test.jpg', contentType: 'image/jpeg' };

beforeEach(() => {
  s3Service.deleteFromCloud.mockResolvedValue();
  processImageUpload.mockImplementation(async (connection, file, catStatus) => {
    const key = `test_post_pic_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const [result] = await connection.query(
      'INSERT INTO pictures (picture_key, cat_status) VALUES (?, ?)',
      [key, catStatus]
    );
    return { pictureId: result.insertId, pictureKey: key };
  });
});

afterEach(async () => {
  await db.pool.query("DELETE FROM pictures WHERE picture_key LIKE 'test_post_pic_%'");
  await db.pool.query("DELETE FROM users WHERE account_id LIKE 'posts_test_%'");
});

afterAll(async () => {
  await db.pool.end();
});

async function registerAndGetToken(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return { token: res.body.token, userId: res.body.user.userId };
}

async function uploadPost(token) {
  return request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .attach('image', FAKE_FILE, FILE_OPTS)
    .field('status', '0');
}

async function getLastPostId() {
  const [rows] = await db.pool.query(
    "SELECT posts.id FROM posts JOIN pictures ON pictures.id = posts.picture_id WHERE pictures.picture_key LIKE 'test_post_pic_%' ORDER BY posts.id DESC LIMIT 1"
  );
  return rows[0].id;
}

describe('POST /api/posts', () => {
  test('without file (authenticated): 400', async () => {
    const { token } = await registerAndGetToken(USER1);
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .field('status', '0');
    expect(res.status).toBe(400);
  });

  test('without status (authenticated): 400', async () => {
    const { token } = await registerAndGetToken(USER1);
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', FAKE_FILE, FILE_OPTS);
    expect(res.status).toBe(400);
  });

  test('anonymous without nickname/password: 400', async () => {
    const res = await request(app)
      .post('/api/posts')
      .attach('image', FAKE_FILE, FILE_OPTS)
      .field('status', '0');
    expect(res.status).toBe(400);
  });

  test('anonymous valid upload: 201, posts row exists in DB', async () => {
    const res = await request(app)
      .post('/api/posts')
      .attach('image', FAKE_FILE, FILE_OPTS)
      .field('status', '0')
      .field('anonymousNickname', 'testcat')
      .field('anonymousPassword', 'anonpass123');
    expect(res.status).toBe(201);
    const [rows] = await db.pool.query(
      "SELECT posts.id FROM posts JOIN pictures ON pictures.id = posts.picture_id WHERE pictures.picture_key LIKE 'test_post_pic_%' AND posts.deleted_at IS NULL"
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  test('authenticated upload: 201, posts row has correct user_id', async () => {
    const { token, userId } = await registerAndGetToken(USER1);
    const res = await uploadPost(token);
    expect(res.status).toBe(201);
    const [rows] = await db.pool.query(
      'SELECT * FROM posts WHERE user_id = ? AND deleted_at IS NULL',
      [userId]
    );
    expect(rows.length).toBe(1);
  });
});

describe('DELETE /api/posts/:id (authenticated)', () => {
  let postId, token1, token2;

  beforeEach(async () => {
    ({ token: token1 } = await registerAndGetToken(USER1));
    ({ token: token2 } = await registerAndGetToken(USER2));
    await uploadPost(token1);
    postId = await getLastPostId();
  });

  test('delete own post: 200, row soft-deleted', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    const [rows] = await db.pool.query(
      'SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL',
      [postId]
    );
    expect(rows.length).toBe(0);
  });

  test('delete another user\'s post: 403', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/posts/:id (anonymous)', () => {
  let postId;

  beforeEach(async () => {
    await request(app)
      .post('/api/posts')
      .attach('image', FAKE_FILE, FILE_OPTS)
      .field('status', '0')
      .field('anonymousNickname', 'testcat')
      .field('anonymousPassword', 'anonpass123');
    postId = await getLastPostId();
  });

  test('correct password: 200', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .send({ anonymousPassword: 'anonpass123' });
    expect(res.status).toBe(200);
  });

  test('wrong password: 403', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .send({ anonymousPassword: 'wrongpassword' });
    expect(res.status).toBe(403);
  });
});

describe('Likes', () => {
  let postId, token;

  beforeEach(async () => {
    ({ token } = await registerAndGetToken(USER1));
    await uploadPost(token);
    postId = await getLastPostId();
  });

  test('GET /:id/likes: 200, count and likedByMe', async () => {
    const res = await request(app).get(`/api/posts/${postId}/likes`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: expect.any(Number), likedByMe: false });
  });

  test('like a post: 200, changed: true', async () => {
    const res = await request(app)
      .post(`/api/posts/${postId}/likes`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ changed: true });
  });

  test('like the same post again: 200, changed: false', async () => {
    await request(app).post(`/api/posts/${postId}/likes`).set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .post(`/api/posts/${postId}/likes`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ changed: false });
  });

  test('unlike a post: 200', async () => {
    await request(app).post(`/api/posts/${postId}/likes`).set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .delete(`/api/posts/${postId}/likes`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/posts/mine', () => {
  test('without auth: 401', async () => {
    const res = await request(app).get('/api/posts/mine');
    expect(res.status).toBe(401);
  });

  test('with auth: 200, array', async () => {
    const { token } = await registerAndGetToken(USER1);
    const res = await request(app)
      .get('/api/posts/mine')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
