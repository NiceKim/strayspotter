/**
 * Token management for OneMap API and other external services.
 */
const { requestOneMapToken } = require('../lib/oneMap.js');

/**
 * Updates an existing access token row in the tokens table.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {{ token_name: string, expire_date: number, access_token: string }} token - Token payload to persist.
 * @returns {Promise<string>} The token_name that was updated.
 */
async function updateAccessToken(pool, token) {
  const query = `UPDATE tokens SET expire_date = ?, access_token = ? WHERE token_name = ?`;
  const [results] = await pool.query(
    query,
    [token.expire_date, token.access_token, token.token_name]
  );
  return results.token_name;
}

/**
 * Fetches an access token row by its name.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {string} tokenName - Name of the token to fetch.
 * @returns {Promise<Object|null>} The token row, or null if it does not exist.
 */
async function fetchAccessToken(pool, tokenName) {
  const query = `SELECT * FROM tokens WHERE token_name = ?`;
  const [results] = await pool.query(query, [tokenName]);
  if (results.length == 0) {
    return null;
  }
  return results[0];
}

/**
 * Inserts a new access token row.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @param {{ token_name: string, expire_date: number, access_token: string }} token - Token payload to insert.
 * @returns {Promise<string>} The token_name that was inserted.
 */
async function saveAccessToken(pool, token) {
  const query = `INSERT INTO tokens (token_name, expire_date, access_token) VALUES (?, ?, ?)`;
  const [results] = await pool.query(query, [
    token.token_name,
    token.expire_date,
    token.access_token
  ]);
  return results.token_name;
}

/**
 * Retrieves a valid OneMap access token:
 * - Returns a cached token from the DB when it exists and is not expired.
 * - Otherwise requests a new token from OneMap and upserts it into the DB.
 *
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool.
 * @returns {Promise<{ token_name: string, expire_date: number, access_token: string }>} A valid OneMap token.
 */
async function getValidToken(pool) {
  let token = await fetchAccessToken(pool, 'onemap');
  const current_time_stamp = Math.floor(Date.now() / 1000);

  if (!token || current_time_stamp > token.expire_date) {
    const token_result = await requestOneMapToken();
    const newToken = {
      token_name: 'onemap',
      expire_date: token_result.expiry_timestamp,
      access_token: token_result.access_token
    };
    if (!token) {
      await saveAccessToken(pool, newToken);
    } else {
      await updateAccessToken(pool, newToken);
    }
    token = newToken;
  }
  return token;
}

module.exports = {
  updateAccessToken,
  fetchAccessToken,
  saveAccessToken,
  getValidToken
};
