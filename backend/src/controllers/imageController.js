const s3Service = require('../services/s3Service');

/**
 * @typedef {Object} ListImagesQuery
 * @property {string} [maxKeys] - Maximum number of image keys to retrieve (stringified integer).
 */

/**
 * @typedef {Object} GetImageUrlQuery
 * @property {string} key - S3 object key to generate a URL for.
 */

/**
 * Retrieves a list of image object keys stored in S3.
 *
 * Request:
 * - Query: {@link ListImagesQuery}
 *
 * Response:
 * - 200 OK: Array of image keys (string[])
 * - On error: empty array []
 *
 * @param {ListImagesQuery} req.query
 * @returns {Promise<void>}
 */
async function listImages(req, res) {
  const maxKeys = parseInt(req.query.maxKeys, 10) || 100;
  try {
    const imageKeys = await s3Service.listImageKeys(maxKeys);
    res.json(imageKeys);
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
