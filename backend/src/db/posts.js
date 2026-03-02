/**
 * Database operations for posts and anonymous posts.
 */
const bcrypt = require('bcrypt');

/**
 * Inserts a new post row linked to a picture and an optional user.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {number} pictureId - ID of the picture associated with the post.
 * @param {number|null} userId - ID of the owning user, or null for anonymous posts.
 * @returns {Promise<number>} ID of the newly created post.
 */
async function insertPostToDb(connection, pictureId, userId) {
  const query = `INSERT INTO posts (picture_id, user_id) VALUES (?, ?)`;
  const [result] = await connection.query(query, [pictureId, userId]);
  return result.insertId;
}

/**
 * Creates an anonymous post record with a hashed password for later verification.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {number} postId - ID of the related post.
 * @param {string} anonymousNickname - Display nickname for the anonymous user.
 * @param {string} anonymousPassword - Plain-text password to hash and store.
 * @returns {Promise<number>} Number of affected rows (1 on success, 0 otherwise).
 */
async function insertAnonymousUserDataToDb(
  connection,
  postId,
  anonymousNickname,
  anonymousPassword
) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(anonymousPassword, saltRounds);

  const query = `INSERT INTO anonymous_posts (post_id, anonymous_nickname, anonymous_password_hash) VALUES (?, ?, ?)`;
  const [result] = await connection.query(query, [
    postId,
    anonymousNickname,
    hashedPassword
  ]);
  return result.affectedRows;
}

/**
 * Fetches a post row by its ID.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {number} postId - ID of the post to fetch.
 * @returns {Promise<Object|undefined>} The post row, or undefined if not found.
 */
async function fetchPostById(connection, postId) {
  const query = `SELECT * FROM posts WHERE id = ?`;
  const [result] = await connection.query(query, [postId]);
  return result[0];
}

/**
 * Fetches an anonymous post record associated with a given post ID.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {number} postId - ID of the related post.
 * @returns {Promise<Object|undefined>} The anonymous post row, or undefined if not found.
 */
async function fetchAnonymousPostById(connection, postId) {
  const query = `SELECT * FROM anonymous_posts WHERE post_id = ?`;
  const [result] = await connection.query(query, [postId]);
  return result[0];
}

/**
 * Deletes a post by its ID.
 *
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').Connection} connection - MySQL pool or connection.
 * @param {number} postId - ID of the post to delete.
 * @returns {Promise<number>} Number of affected rows (1 on success, 0 if nothing was deleted).
 */
async function deletePost(connection, postId) {
  const query = `DELETE FROM posts WHERE id = ?`;
  const [result] = await connection.query(query, [postId]);
  return result.affectedRows;
}


module.exports = {
  insertPostToDb,
  insertAnonymousUserDataToDb,
  fetchPostById,
  fetchAnonymousPostById,
  deletePost
};