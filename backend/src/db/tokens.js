/**
 * Token management for OneMap API and other external services.
 */
const { requestOneMapToken } = require('../lib/oneMap.js');

async function updateAccessToken(connection, token) {
  const query = `UPDATE tokens SET expire_date = ?, access_token = ? WHERE token_name = ?`;
  const [results] = await connection.query(
    query,
    [token.expire_date, token.access_token, token.token_name]
  );
  return results.token_name;
}

async function fetchAccessToken(connection, tokenName) {
  const query = `SELECT * FROM tokens WHERE token_name = ?`;
  const [results] = await connection.query(query, [tokenName]);
  if (results.length == 0) {
    return null;
  }
  return results[0];
}

async function saveAccessToken(connection, token) {
  const query = `INSERT INTO tokens (token_name, expire_date, access_token) VALUES (?, ?, ?)`;
  const [results] = await connection.query(query, [
    token.token_name,
    token.expire_date,
    token.access_token
  ]);
  return results.token_name;
}

async function getValidToken(connection) {
  let token = await fetchAccessToken(connection, 'onemap');
  const current_time_stamp = Math.floor(Date.now() / 1000);

  if (!token || current_time_stamp > token.expire_date) {
    const token_result = await requestOneMapToken();
    const newToken = {
      token_name: 'onemap',
      expire_date: token_result.expiry_timestamp,
      access_token: token_result.access_token
    };
    if (!token) {
      await saveAccessToken(connection, newToken);
    } else {
      await updateAccessToken(connection, newToken);
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
