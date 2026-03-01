async function fetchUserById(connection, id) {
    const query = `SELECT * FROM users WHERE id = ?`;
    const [result] = await connection.query(query, [id]);
    return result[0];
}

async function fetchUserByAccountId(connection, accountId) {
    const query = `SELECT * FROM users WHERE account_id = ?`;
    const [result] = await connection.query(query, [accountId]);
    return result[0];
}

async function fetchUserByEmail(connection, email) {
    const query = `SELECT * FROM users WHERE email = ?`;
    const [result] = await connection.query(query, [email]);
    return result[0];
}

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