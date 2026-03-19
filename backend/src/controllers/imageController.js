const db = require('../db');
const s3Service = require('../services/s3Service');
const { ValidationError } = require('../../errors/CustomError');

/**
 * @typedef {Object} ListImagesQuery
 * @property {string} [maxKeys] - Maximum number of posts to retrieve (stringified integer).
 * @property {string} [offset] - Number of posts to skip for pagination (stringified integer).
 */

/**
 * @typedef {Object} GetImageUrlQuery
 * @property {string} key - S3 object key to generate a URL for (e.g. k{picture_id}.jpg).
 */

/**
 * Retrieves a list of posts from the database (id, picture_id, body, created_at, user_id, etc.).
 * Frontend builds image key as `k{picture_id}.jpg` when requesting presigned URL.
 *
 * Request:
 * - Query: {@link ListImagesQuery}
 *
 * Response:
 * - 200 OK: Array of post rows (id, picture_id, body, created_at, user_id, ...)
 * - On error: empty array []
 *
 * @param {ListImagesQuery} req.query
 * @returns {Promise<void>}
 */
async function listImages(req, res, next) {
  const limit = parseInt(req.query.maxKeys, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;
  try {
    const posts = await db.fetchPosts(db.pool, limit, offset);
    res.json(posts);
  } catch (err) {
    next(err);
  }
}

/**
 * Generates a presigned URL for a specific S3 object key.
 *
 * Request:
 * - Query: {@link GetImageUrlQuery}
 *
 * Response:
 * - 200 OK: { url: string }
 * - 400 Bad Request: when key is missing
 * - On other errors: returns a fallback URL
 *
 * @param {GetImageUrlQuery} req.query
 * @returns {Promise<void>}
 */
async function getImageUrl(req, res, next) {
  const { key } = req.query;
  try {
    if (!key) {
      throw new ValidationError('Key is required');
    }
    const url = await s3Service.getPresignedUrl(key);
    res.json({ url });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listImages,
  getImageUrl
};
