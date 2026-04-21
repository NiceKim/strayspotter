/**
 * Transaction-only unit tests for postController.
 *
 * Scope:
 * - uploadImage: transaction lifecycle + S3 cleanup on DB failure after upload
 * - deletePost: transaction lifecycle (commit/rollback/release)
 */

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

const makeConnection = () => ({
  beginTransaction: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  release: jest.fn()
});

// Mocks must be declared before requiring the controller.
jest.mock('../../../src/db', () => ({
  pool: {
    getConnection: jest.fn()
  },
  fetchPostById: jest.fn(),
  fetchAnonymousPostById: jest.fn(),
  insertPostToDb: jest.fn(),
  insertAnonymousUserDataToDb: jest.fn(),
  deletePictureById: jest.fn(),
  deletePost: jest.fn()
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
const bcrypt = require('bcrypt');

const { uploadImage, deletePost } = require('../../../src/controllers/postController');

describe('postController transaction-only', () => {
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
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
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
      const res = makeRes();
      const next = jest.fn();

      await uploadImage(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(next.mock.calls[0][0].message).toBe('db insert failed');
    });
  });

  describe('deletePost (transaction only)', () => {
    test('success: beginTransaction -> commit -> release, no rollback', async () => {
      const connection = makeConnection();
      db.pool.getConnection.mockResolvedValue(connection);
      db.fetchPostById.mockResolvedValue({ id: 1, user_id: 123, picture_id: 7 });
      db.deletePictureById.mockResolvedValue(1);
      db.deletePost.mockResolvedValue(1);

      const req = {
        userId: 123,
        params: { id: '1' },
        body: {}
      };
      const res = makeRes();
      const next = jest.fn();

      await deletePost(req, res, next);

      expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(connection.commit).toHaveBeenCalledTimes(1);
      expect(connection.rollback).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('DB failure: deletePictureById returns 0 -> rollback + release + next(err)', async () => {
      const connection = makeConnection();
      db.pool.getConnection.mockResolvedValue(connection);
      db.fetchPostById.mockResolvedValue({ id: 1, user_id: 123, picture_id: 7 });
      db.deletePictureById.mockResolvedValue(0);

      const req = {
        userId: 123,
        params: { id: '1' },
        body: {}
      };
      const res = makeRes();
      const next = jest.fn();

      await deletePost(req, res, next);

      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('commit failure: commit throws -> rollback attempted + release + next(err)', async () => {
      const connection = makeConnection();
      connection.commit.mockRejectedValue(new Error('commit failed'));
      db.pool.getConnection.mockResolvedValue(connection);
      db.fetchPostById.mockResolvedValue({ id: 1, user_id: 123, picture_id: 7 });
      db.deletePictureById.mockResolvedValue(1);
      db.deletePost.mockResolvedValue(1);

      const req = {
        userId: 123,
        params: { id: '1' },
        body: {}
      };
      const res = makeRes();
      const next = jest.fn();

      await deletePost(req, res, next);

      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(next.mock.calls[0][0].message).toBe('commit failed');
    });
  });
});

