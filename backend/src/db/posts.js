/**
 * Database operations for posts and anonymous posts.
 */
const bcrypt = require('bcrypt');

async function insertPostToDb(connection, pictureId, userId) {
  const query = `INSERT INTO posts (picture_id, user_id) VALUES (?, ?)`;
  const [result] = await connection.query(query, [pictureId, userId]);
  return result.insertId;
}

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

module.exports = {
  insertPostToDb,
  insertAnonymousUserDataToDb
};