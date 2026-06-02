const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

const makeConnection = () => ({
  beginTransaction: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  release: jest.fn()
});

jest.mock('../../../src/db', () => ({
  pool: {
    getConnection: jest.fn()
  },
  fetchPostById: jest.fn(),
  fetchAnonymousPostById: jest.fn(),
  insertPostToDb: jest.fn(),
  insertAnonymousUserDataToDb: jest.fn(),
  deletePictureById: jest.fn(),
  deletePost: jest.fn(),
  fetchLikesByPostId: jest.fn(),
  hasUserLikedPost: jest.fn(),
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  fetchPostsByUserId: jest.fn(),
  fetchMyPostsCount: jest.fn()
}));

jest.mock('../../../src/services/image_handler', () => ({
  processImageUpload: jest.fn()
}));

jest.mock('../../../src/services/s3Service', () => ({
  deleteFromCloud: jest.fn()
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

const db = require('../../../src/db');
const { processImageUpload } = require('../../../src/services/image_handler');
const s3Service = require('../../../src/services/s3Service');
const { ValidationError } = require('../../../errors/CustomError');
const {
  uploadImage, deletePost,
  getLikes, likePost, unlikePost,
  getMyPosts, getMyPostsCount
} = require('../../../src/controllers/postController');

describe('postController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadImage (transaction + cleanup)', () => {
    test('success: beginTransaction -> commit -> release, no rollback', async () => {
      const connection = makeConnection();
      db.pool.getConnection.mockResolvedValue(connection);
      processImageUpload.mockResolvedValue({ pictureId: 10, pictureKey: 'k.jpg' });
      db.insertPostToDb.mockResolvedValue(99);

      const req = {
        file: { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'a.jpg' },
        body: { status: '0', anonymousNickname: 'n', anonymousPassword: 'p' },
        userId: 123
      };
      const res = makeRes();
      const next = jest.fn();

      await uploadImage(req, res, next);

      expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(connection.commit).toHaveBeenCalledTimes(1);
      expect(connection.rollback).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('DB failure after upload: rollback + cleanup(deleteFromCloud) + release', async () => {
      const connection = makeConnection();
      db.pool.getConnection.mockResolvedValue(connection);
      processImageUpload.mockResolvedValue({ pictureId: 10, pictureKey: 'k.jpg' });
      db.insertPostToDb.mockRejectedValue(new Error('db insert failed'));

      const req = {
        file: { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'a.jpg' },
        body: { status: '0' },
        userId: 123
      };
      const res = makeRes();
      const next = jest.fn();

      await uploadImage(req, res, next);

      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(s3Service.deleteFromCloud).toHaveBeenCalledWith('k.jpg');
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0].message).toBe('db insert failed');
    });

    test('cleanup failure: still calls next(original error)', async () => {
      const connection = makeConnection();
      db.pool.getConnection.mockResolvedValue(connection);
      processImageUpload.mockResolvedValue({ pictureId: 10, pictureKey: 'k.jpg' });
      db.insertPostToDb.mockRejectedValue(new Error('db insert failed'));
      s3Service.deleteFromCloud.mockRejectedValue(new Error('cleanup failed'));

      const req = {
        file: { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'a.jpg' },
        body: { status: '0' },
        userId: 123
      };
      const next = jest.fn();

      await uploadImage(req, makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0].message).toBe('db insert failed');
    });
  });

  describe('deletePost (transaction)', () => {
    test('success: beginTransaction -> commit -> release, no rollback', async () => {
      const connection = makeConnection();
      db.pool.getConnection.mockResolvedValue(connection);
      db.fetchPostById.mockResolvedValue({ id: 1, user_id: 123, picture_id: 7 });
      db.deletePictureById.mockResolvedValue(1);
      db.deletePost.mockResolvedValue(1);

      const req = { userId: 123, params: { id: '1' }, body: {} };
      const res = makeRes();
      const next = jest.fn();

      await deletePost(req, res, next);

      expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(connection.commit).toHaveBeenCalledTimes(1);
      expect(connection.rollback).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    test('DB failure: deletePictureById returns 0 -> rollback + release + next(err)', async () => {
      const connection = makeConnection();
      db.pool.getConnection.mockResolvedValue(connection);
      db.fetchPostById.mockResolvedValue({ id: 1, user_id: 123, picture_id: 7 });
      db.deletePictureById.mockResolvedValue(0);

      const req = { userId: 123, params: { id: '1' }, body: {} };
      const next = jest.fn();

      await deletePost(req, makeRes(), next);

      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('commit failure: rollback attempted + release + next(err)', async () => {
      const connection = makeConnection();
      connection.commit.mockRejectedValue(new Error('commit failed'));
      db.pool.getConnection.mockResolvedValue(connection);
      db.fetchPostById.mockResolvedValue({ id: 1, user_id: 123, picture_id: 7 });
      db.deletePictureById.mockResolvedValue(1);
      db.deletePost.mockResolvedValue(1);

      const req = { userId: 123, params: { id: '1' }, body: {} };
      const next = jest.fn();

      await deletePost(req, makeRes(), next);

      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0].message).toBe('commit failed');
    });
  });

  describe('getLikes', () => {
    test('missing post ID: calls next with ValidationError', async () => {
      const req = { params: {}, userId: null };
      const next = jest.fn();
      await getLikes(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('no auth: likedByMe is false, hasUserLikedPost not called', async () => {
      db.fetchLikesByPostId.mockResolvedValue(5);
      const req = { params: { id: '1' }, userId: null };
      const res = makeRes();
      const next = jest.fn();

      await getLikes(req, res, next);

      expect(db.hasUserLikedPost).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ count: 5, likedByMe: false });
    });

    test('with auth: hasUserLikedPost called, likedByMe reflects result', async () => {
      db.fetchLikesByPostId.mockResolvedValue(3);
      db.hasUserLikedPost.mockResolvedValue(true);
      const req = { params: { id: '1' }, userId: 7 };
      const res = makeRes();
      const next = jest.fn();

      await getLikes(req, res, next);

      expect(db.hasUserLikedPost).toHaveBeenCalledWith(db.pool, '1', 7);
      expect(res.json).toHaveBeenCalledWith({ count: 3, likedByMe: true });
    });
  });

  describe('likePost', () => {
    test('missing post ID: calls next with ValidationError', async () => {
      const req = { params: {}, userId: 1 };
      const next = jest.fn();
      await likePost(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('missing user ID: calls next with ValidationError', async () => {
      const req = { params: { id: '1' }, userId: null };
      const next = jest.fn();
      await likePost(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('already liked: responds with changed: false', async () => {
      db.likePost.mockResolvedValue(0);
      const req = { params: { id: '1' }, userId: 7 };
      const res = makeRes();
      const next = jest.fn();

      await likePost(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ changed: false, message: 'Post already liked' });
      expect(next).not.toHaveBeenCalled();
    });

    test('success: responds with changed: true', async () => {
      db.likePost.mockResolvedValue(1);
      const req = { params: { id: '1' }, userId: 7 };
      const res = makeRes();
      const next = jest.fn();

      await likePost(req, res, next);

      expect(db.likePost).toHaveBeenCalledWith(db.pool, '1', 7);
      expect(res.json).toHaveBeenCalledWith({ changed: true, message: 'Post liked successfully' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('unlikePost', () => {
    test('missing post ID: calls next with ValidationError', async () => {
      const req = { params: {}, userId: 1 };
      const next = jest.fn();
      await unlikePost(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('missing user ID: calls next with ValidationError', async () => {
      const req = { params: { id: '1' }, userId: null };
      const next = jest.fn();
      await unlikePost(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('already unliked: responds with changed: false', async () => {
      db.unlikePost.mockResolvedValue(0);
      const req = { params: { id: '1' }, userId: 7 };
      const res = makeRes();
      const next = jest.fn();

      await unlikePost(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ changed: false, message: 'Post already unliked' });
      expect(next).not.toHaveBeenCalled();
    });

    test('success: responds with changed: true', async () => {
      db.unlikePost.mockResolvedValue(1);
      const req = { params: { id: '1' }, userId: 7 };
      const res = makeRes();
      const next = jest.fn();

      await unlikePost(req, res, next);

      expect(db.unlikePost).toHaveBeenCalledWith(db.pool, '1', 7);
      expect(res.json).toHaveBeenCalledWith({ changed: true, message: 'Post unliked successfully' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getMyPosts', () => {
    test('default pagination: limit 10 offset 0 passed to db', async () => {
      db.fetchPostsByUserId.mockResolvedValue([]);
      const req = { userId: 1, query: {} };
      const next = jest.fn();

      await getMyPosts(req, makeRes(), next);

      expect(db.fetchPostsByUserId).toHaveBeenCalledWith(db.pool, 1, 10, 0);
    });

    test('custom pagination: limit and offset passed through from query', async () => {
      db.fetchPostsByUserId.mockResolvedValue([]);
      const req = { userId: 1, query: { limit: '5', offset: '20' } };
      const next = jest.fn();

      await getMyPosts(req, makeRes(), next);

      expect(db.fetchPostsByUserId).toHaveBeenCalledWith(db.pool, 1, 5, 20);
    });

    test('success: responds 200 with posts array', async () => {
      const posts = [{ id: 1 }, { id: 2 }];
      db.fetchPostsByUserId.mockResolvedValue(posts);
      const req = { userId: 1, query: {} };
      const res = makeRes();
      const next = jest.fn();

      await getMyPosts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(posts);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getMyPostsCount', () => {
    test('success: responds 200 with count', async () => {
      db.fetchMyPostsCount.mockResolvedValue(42);
      const req = { userId: 1 };
      const res = makeRes();
      const next = jest.fn();

      await getMyPostsCount(req, res, next);

      expect(db.fetchMyPostsCount).toHaveBeenCalledWith(db.pool, 1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(42);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
