/**
 * Database operations for posts and anonymous posts.
 */
const bcrypt = require('bcrypt');

/**
 * Inserts a new post row linked to a picture and an optional user.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} pictureId - ID of the picture associated with the post.
 * @param {number|null} userId - ID of the owning user, or null for anonymous posts.
 * @returns {Promise<number>} ID of the newly created post.
 */
async function insertPostToDb(pool, pictureId, userId) {
  const query = `INSERT INTO posts (picture_id, user_id) VALUES (?, ?)`;
  const [result] = await pool.query(query, [pictureId, userId]);
  return result.insertId;
}

/**
 * Creates an anonymous post record with a hashed password for later verification.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} postId - ID of the related post.
 * @param {string} anonymousNickname - Display nickname for the anonymous user.
 * @param {string} anonymousPassword - Plain-text password to hash and store.
 * @returns {Promise<number>} Number of affected rows (1 on success, 0 otherwise).
 */
async function insertAnonymousUserDataToDb(
  pool,
  postId,
  anonymousNickname,
  anonymousPassword
) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(anonymousPassword, saltRounds);

  const query = `INSERT INTO anonymous_posts (post_id, anonymous_nickname, anonymous_password_hash) VALUES (?, ?, ?)`;
  const [result] = await pool.query(query, [
    postId,
    anonymousNickname,
    hashedPassword
  ]);
  return result.affectedRows;
}

/**
 * Fetches a post row by its ID.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} postId - ID of the post to fetch.
 * @returns {Promise<Object|undefined>} The post row, or undefined if not found.
 */
async function fetchPostById(pool, postId) {
  const query = `SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL`;
  const [result] = await pool.query(query, [postId]);
  return result[0];
}

/**
 * Fetches an anonymous post record associated with a given post ID.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} postId - ID of the related post.
 * @returns {Promise<Object|undefined>} The anonymous post row, or undefined if not found.
 */
async function fetchAnonymousPostById(pool, postId) {
  const query = `SELECT * FROM anonymous_posts WHERE post_id = ?`;
  const [result] = await pool.query(query, [postId]);
  return result[0];
}

/**
 * Deletes a post by its ID.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} postId - ID of the post to delete.
 * @returns {Promise<number>} Number of affected rows (1 on success, 0 if nothing was deleted).
 */
async function deletePost(pool, postId) {
  const query = `UPDATE posts SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`;
  const [result] = await pool.query(query, [postId]);
  return result.affectedRows;
}

/**
 * Fetches posts from the database.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} limit - Number of posts to fetch.
 * @param {number} offset - Number of posts to skip.
 * @returns {Promise<Object[]>} Array of post rows.
 */
async function fetchPosts(pool, limit = 10, offset = 0) {
  const query = `
    SELECT
      posts.id,
      posts.picture_id,
      posts.user_id,
      posts.created_at,
      pictures.picture_key,
      pictures.cat_status,
      users.account_id
    FROM posts
    JOIN pictures ON pictures.id = posts.picture_id
    LEFT JOIN users ON users.id = posts.user_id
    WHERE posts.deleted_at IS NULL
    ORDER BY posts.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const [result] = await pool.query(query, [limit, offset]);
  return result;
}

/**
 * Fetches posts by user ID.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} userId - ID of the user to fetch posts for.
 * @param {number} limit - Number of posts to fetch.
 * @param {number} offset - Number of posts to skip.
 * @returns {Promise<Object[]>} Array of post rows.
 */
async function fetchPostsByUserId(pool, userId, limit = 10, offset = 0) {
  const query = `
    SELECT
      posts.id,
      posts.picture_id,
      posts.user_id,
      posts.created_at,
      pictures.picture_key,
      pictures.cat_status,
      users.account_id
    FROM posts
    JOIN pictures ON pictures.id = posts.picture_id
    LEFT JOIN users ON users.id = posts.user_id
    WHERE posts.deleted_at IS NULL and posts.user_id = ?
    ORDER BY posts.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const [result] = await pool.query(query, [userId, limit, offset]);
  return result;
}

/**
 * Fetches like count for a specific post.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} postId - ID of the post.
 * @returns {Promise<number>} Total number of likes for the post.
 */
async function fetchLikesByPostId(pool, postId) {
  const query = `SELECT COUNT(*) As count FROM likes WHERE post_id = ?`;
  const [result] = await pool.query(query, [postId]);
  return result[0].count;
}

/**
 * Returns whether the given user has liked the post.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} postId - ID of the post.
 * @param {number} userId - ID of the user.
 * @returns {Promise<boolean>}
 */
async function hasUserLikedPost(pool, postId, userId) {
  const query = `SELECT 1 FROM likes WHERE post_id = ? AND user_id = ? LIMIT 1`;
  const [rows] = await pool.query(query, [postId, userId]);
  return rows.length > 0;
}

/**
 * Inserts a like row for a post-user pair.
 *
 * Uses MySQL `INSERT IGNORE` so duplicate likes are ignored
 * without throwing an error.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} postId - ID of the post to like.
 * @param {number} userId - ID of the user liking the post.
 * @returns {Promise<number>} Affected rows (1 if inserted, 0 if already liked).
 */
async function likePost(pool, postId, userId) {
  const query = `INSERT IGNORE INTO likes (post_id, user_id) VALUES (?, ?)`;
  const [result] = await pool.query(query, [postId, userId]);
  return result.affectedRows;
}

/**
 * Deletes a like row for a post-user pair.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} postId - ID of the post to unlike.
 * @param {number} userId - ID of the user unliking the post.
 * @returns {Promise<number>} Affected rows (1 if deleted, 0 if already unliked).
 */
async function unlikePost(pool, postId, userId) {
  const query = `DELETE FROM likes WHERE post_id = ? AND user_id = ?`;
  const [result] = await pool.query(query, [postId, userId]);
  return result.affectedRows;
}

/**
 * Fetches the count of posts for a specific user.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {number} userId - ID of the user to fetch posts for.
 * @returns {Promise<number>} The count of posts for the user.
 */
async function fetchMyPostsCount(pool, userId) {
  const query = `SELECT COUNT(*) AS count FROM posts WHERE user_id = ? AND deleted_at IS NULL`;
  const [result] = await pool.query(query, [userId]);
  return result[0].count;
}


module.exports = {
  insertPostToDb,
  insertAnonymousUserDataToDb,
  fetchPostById,
  fetchAnonymousPostById,
  fetchPostsByUserId,
  deletePost,
  fetchPosts,
  fetchLikesByPostId,
  hasUserLikedPost,
  likePost,
  unlikePost,
  fetchMyPostsCount
};