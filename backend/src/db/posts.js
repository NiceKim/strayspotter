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


module.exports = {
  insertPostToDb,
  insertAnonymousUserDataToDb,
  fetchPostById,
  fetchAnonymousPostById,
  deletePost,
  fetchPosts
};