const db = require('../db');
const { processImageUpload } = require('../services/image_handler');
const bcrypt = require('bcrypt');
const { CustomError } = require('../../errors/CustomError');

/**
 * @typedef {Object} UploadImageBody
 * @property {string} status - "0" | "1" | "2" (cat status).
 * @property {string} [anonymousNickname] - Nickname to use when uploading anonymously.
 * @property {string} [anonymousPassword] - Plain-text password for anonymous uploads.
 */

/**
 * @typedef {Object} DeletePostParams
 * @property {string} postId - ID of the post to delete.
 */

/**
 * @typedef {Object} DeletePostBody
 * @property {string} [anonymousPassword] - Optional password used only when deleting an anonymous post.
 */

/**
 * Uploads a cat picture and creates a new post for either an authenticated or anonymous user.
 *
 * Request:
 * - Headers:
 *   - Authorization: Bearer token (optional; if missing, the upload is treated as anonymous)
 * - Body: {@link UploadImageBody}
 * - File:
 *   - file (required): Image file parsed into `req.file` by middleware.
 *
 * Response:
 * - 201 Created: 'Picture successfully uploaded'
 * - 400 Bad Request: Missing required fields or invalid status
 * - 500 Internal Server Error: Any failure during upload or processing
 *
 * @param {UploadImageBody} req.body
 * @returns {Promise<void>}
 */
async function uploadImage(req, res) {
  const file = req.file;
  const status = req.body.status;
  const userId = req.userId;
  const anonymousNickname = req.body.anonymousNickname;
  const anonymousPassword = req.body.anonymousPassword;

  if (!userId && (!anonymousNickname || !anonymousPassword)) {
    return res.status(400).send('Anonymous nickname and password are required!');
  }
  if (!file) return res.status(400).send('No file selected!');
  if (!status) return res.status(400).send('Status is required!');

  const catStatus = parseInt(status, 10);
  if (isNaN(catStatus) || catStatus < 0 || catStatus > 2) {
    return res.status(400).send('Invalid status. Must be 0 (good), 1 (concerned), or 2 (critical).');
  }

  const pool = db.pool;
  try {
    const pictureId = await processImageUpload(pool, file, catStatus);
    const postId = await db.insertPostToDb(pool, pictureId, userId);
    if (!userId) {
      await db.insertAnonymousUserDataToDb(pool, postId, anonymousNickname, anonymousPassword);
    }
    res.status(201).send('Picture successfully uploaded');
  } catch (err) {
    console.error('General error in upload:', err);

    if (err instanceof CustomError && err.statusCode) {
      return res.status(err.statusCode).send(err.message);
    }
    if (err.statusCode && Number.isInteger(err.statusCode)) {
      return res.status(err.statusCode).send(err.message);
    }
    
    res.status(500).send('File upload failed due to errors');
  }
}

/**
 * Deletes a post either by its owning user or by an anonymous user with the correct password.
 *
 * Request:
 * - Headers:
 *   - Authorization: Bearer token (optional; required to delete posts owned by an authenticated user)
 * - Params: {@link DeletePostParams}
 * - Body: {@link DeletePostBody}
 *
 * Behavior:
 * - For posts created by authenticated users: `req.userId` (set by auth middleware from the token) must match `post.user_id`.
 * - For anonymous posts: `anonymousPassword` must be provided and must match the stored hash.
 *
 * Response:
 * - 400 Bad Request: Missing postId or anonymousPassword when required
 * - 403 Forbidden: Unauthorized to delete the post
 * - 404 Not Found: Post or anonymous post record not found
 * - 500 Internal Server Error: Failed to delete the post
 *
 * @param {DeletePostParams} req.params
 * @param {DeletePostBody} req.body
 * @returns {Promise<void>}
 */
async function deletePost(req, res, next) {
  try {
    const userId = req.userId;
    const postId = req.params.id;
    const anonymousPassword = req.body.anonymousPassword;

    if (!postId) {
      return res.status(400).send('Post ID is required');
    }
    const pool = db.pool;
    const post = await db.fetchPostById(pool, postId);
    if (!post) {
      return res.status(404).send('Post not found');
    }

    if (post.user_id) { 
      if (post.user_id !== userId) {
        return res.status(403).send('Unauthorized to delete this post');
      }
    } else {
      if (!anonymousPassword) {
        return res.status(400).send('Anonymous password is required');
      }
      const anonymousPost = await db.fetchAnonymousPostById(pool, postId);
      if (!anonymousPost) {
        return res.status(404).send('Anonymous post not found');
      }
      const isPasswordValid = await bcrypt.compare(anonymousPassword, anonymousPost.anonymous_password_hash);
      if (!isPasswordValid) {
        return res.status(403).send('Unauthorized to delete this post');
      }
    }
    //TODO: Add transaction to delete the picture and post together
    const pictureResult = await db.deletePictureById(pool, post.picture_id);
    if (pictureResult === 0) {
      return res.status(500).send('Failed to delete picture');
    }
    const postResult = await db.deletePost(pool, postId);
    if (postResult === 0) {
      return res.status(500).send('Failed to delete post');
    }
    res.status(200).send('Post deleted successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadImage,
  deletePost
};
