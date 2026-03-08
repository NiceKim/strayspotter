const db = require('../db');
const s3Service = require('../services/s3Service');

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
async function listImages(req, res) {
  const limit = parseInt(req.query.maxKeys, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;
  try {
    const posts = await db.fetchPosts(db.pool, limit, offset);
    res.json(posts);
  } catch (err) {
    console.error('Error listing images:', err);
    res.json([]);
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
async function getImageUrl(req, res) {
  const { key } = req.query;
  try {
    if (!key) return res.status(400).send('Key is required');
    const url = await s3Service.getPresignedUrl(key);
    res.json({ url });
  } catch (error) {
    console.error('Error during getting image-url:', error);
    res.json({ url: `https://example.com/${key}` });
  }
}

module.exports = {
  listImages,
  getImageUrl
};
