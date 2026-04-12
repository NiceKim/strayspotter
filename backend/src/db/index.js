/**
 * Database module - pool and re-exports.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: 'admin',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const pictures = require('./pictures.js');
const posts = require('./posts.js');
const tokens = require('./tokens.js');
const users = require('./user.js');

module.exports = {
  pool,
  getValidToken: tokens.getValidToken,
  ...pictures,
  ...posts,
  ...users
};
