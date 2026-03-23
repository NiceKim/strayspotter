const db = require('../db');
const { processImageUpload } = require('../services/image_handler');
const bcrypt = require('bcrypt');
const s3Service = require('../services/s3Service');
const {
  CustomError,
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../../errors/CustomError');

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
async function uploadImage(req, res, next) {
  const pool = db.pool;
  let connection;
  let pictureKey = null;

  const file = req.file;
  const status = req.body.status;
  const userId = req.userId;
  const anonymousNickname = req.body.anonymousNickname;
  const anonymousPassword = req.body.anonymousPassword;

  try {
    if (!userId && (!anonymousNickname || !anonymousPassword)) {
      throw new ValidationError('Anonymous nickname and password are required!');
    }
    if (!file) {
      throw new ValidationError('No file selected!');
    }
    if (!status) {
      throw new ValidationError('Status is required!');
    }

    const catStatus = parseInt(status, 10);
    if (isNaN(catStatus) || catStatus < 0 || catStatus > 2) {
      throw new ValidationError(
        'Invalid status. Must be 0 (good), 1 (concerned), or 2 (critical).'
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    let pictureId;
    ({ pictureId, pictureKey} = await processImageUpload(connection, file,catStatus));
    const postId = await db.insertPostToDb(connection, pictureId, userId);
    if (!userId) {
      await db.insertAnonymousUserDataToDb(connection, postId, anonymousNickname, anonymousPassword);
    }
    await connection.commit();
    res.status(201).send('Picture successfully uploaded');
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    if (pictureKey) {
      try {
        await s3Service.deleteFromCloud(pictureKey);
      } catch (cleanupErr) {
        console.error('Failed to clean up uploaded S3 object:', cleanupErr);
      }
    }
    next(err);
  } finally {
    if (connection) connection.release();
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
  const pool = db.pool;
  let connection;

  try {
    const userId = req.userId;
    const postId = req.params.id;
    const anonymousPassword = req.body.anonymousPassword;

    if (!postId) {
      throw new ValidationError('Post ID is required');
    }

    const post = await db.fetchPostById(pool, postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.user_id) {
      if (post.user_id !== userId) {
        throw new ForbiddenError('Unauthorized to delete this post');
      }
    } else {
      if (!anonymousPassword) {
        throw new ValidationError('Anonymous password is required');
      }

      const anonymousPost = await db.fetchAnonymousPostById(pool, postId);
      if (!anonymousPost) {
        throw new NotFoundError('Anonymous post not found');
      }

      const isPasswordValid = await bcrypt.compare(
        anonymousPassword,
        anonymousPost.anonymous_password_hash
      );
      if (!isPasswordValid) {
        throw new ForbiddenError('Unauthorized to delete this post');
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const pictureResult = await db.deletePictureById(connection, post.picture_id);
    if (pictureResult === 0) {
      throw new CustomError('Failed to delete picture', 500);
    }

    const postResult = await db.deletePost(connection, postId);
    if (postResult === 0) {
      throw new CustomError('Failed to delete post', 500);
    }

    await connection.commit();
    res.status(200).send('Post deleted successfully');
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    next(err);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  uploadImage,
  deletePost
};
