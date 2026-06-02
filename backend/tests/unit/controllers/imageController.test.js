const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

jest.mock('../../../src/db', () => ({
  pool: {},
  fetchPosts: jest.fn()
}));

jest.mock('../../../src/services/s3Service', () => ({
  getPresignedUrl: jest.fn()
}));

const db = require('../../../src/db');
const s3Service = require('../../../src/services/s3Service');
const { ValidationError } = require('../../../errors/CustomError');
const { listImages, getImageUrl } = require('../../../src/controllers/imageController');

describe('imageController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listImages', () => {
    test('no query params: defaults to limit 100, offset 0', async () => {
      db.fetchPosts.mockResolvedValue([]);
      const req = { query: {} };
      const next = jest.fn();

      await listImages(req, makeRes(), next);

      expect(db.fetchPosts).toHaveBeenCalledWith(db.pool, 100, 0);
    });

    test('custom maxKeys and offset: passed to db.fetchPosts', async () => {
      db.fetchPosts.mockResolvedValue([]);
      const req = { query: { maxKeys: '5', offset: '10' } };
      const next = jest.fn();

      await listImages(req, makeRes(), next);

      expect(db.fetchPosts).toHaveBeenCalledWith(db.pool, 5, 10);
    });

    test('success: responds with posts array', async () => {
      const posts = [{ id: 1 }, { id: 2 }];
      db.fetchPosts.mockResolvedValue(posts);
      const req = { query: {} };
      const res = makeRes();
      const next = jest.fn();

      await listImages(req, res, next);

      expect(res.json).toHaveBeenCalledWith(posts);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getImageUrl', () => {
    test('missing key: calls next with ValidationError', async () => {
      const req = { query: {} };
      const next = jest.fn();

      await getImageUrl(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('success: calls getPresignedUrl with key and responds with url', async () => {
      s3Service.getPresignedUrl.mockResolvedValue('https://presigned.url');
      const req = { query: { key: 'k1.jpg' } };
      const res = makeRes();
      const next = jest.fn();

      await getImageUrl(req, res, next);

      expect(s3Service.getPresignedUrl).toHaveBeenCalledWith('k1.jpg');
      expect(res.json).toHaveBeenCalledWith({ url: 'https://presigned.url' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
