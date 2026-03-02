/**
 * Fetches a user row by its numeric ID.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {number} id - User ID.
 * @returns {Promise<Object|undefined>} The user row, or undefined if not found.
 */
async function fetchUserById(connection, id) {
    const query = `SELECT * FROM users WHERE id = ?`;
    const [result] = await connection.query(query, [id]);
    return result[0];
}

/**
 * Fetches a user row by account ID.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {string} accountId - Account identifier for the user.
 * @returns {Promise<Object|undefined>} The user row, or undefined if not found.
 */
async function fetchUserByAccountId(connection, accountId) {
    const query = `SELECT * FROM users WHERE account_id = ?`;
    const [result] = await connection.query(query, [accountId]);
    return result[0];
}

/**
 * Fetches a user row by email.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {string} email - User email address.
 * @returns {Promise<Object|undefined>} The user row, or undefined if not found.
 */
async function fetchUserByEmail(connection, email) {
    const query = `SELECT * FROM users WHERE email = ?`;
    const [result] = await connection.query(query, [email]);
    return result[0];
}

/**
 * Inserts a new user with accountId, hashed password, and email.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {string} accountId - Account identifier to be stored.
 * @param {string} passwordHash - Hashed password string.
 * @param {string} email - User email address.
 * @returns {Promise<number>} ID of the newly created user.
 */
async function insertUser(connection, accountId, passwordHash, email) {
    const query = `INSERT INTO users (account_id, password_hash, email) VALUES (?, ?, ?)`;
    const [result] = await connection.query(query, [accountId, passwordHash, email]);
    return result.insertId;
}

module.exports = {
  fetchUserById,
  fetchUserByAccountId,
  fetchUserByEmail,
  insertUser
};