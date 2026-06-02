const { execSync } = require('child_process');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'root',
  database: 'strayspotter_database_test',
  multipleStatements: true,
};

async function waitForMySQL(retries = 20, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mysql.createConnection(DB_CONFIG);
      await conn.end();
      return;
    } catch {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('MySQL test container did not become ready in time');
}

async function applySchema(conn) {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../init.sql'), 'utf8');
  const filtered = sql
    .split('\n')
    .filter(line => !line.startsWith('CREATE DATABASE') && !line.startsWith('USE '))
    .join('\n');
  await conn.query(filtered);
}

module.exports = async () => {
  execSync('docker compose -f docker-compose.test.yml up -d', {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
  });

  await waitForMySQL();

  const conn = await mysql.createConnection(DB_CONFIG);
  await applySchema(conn);
  await conn.end();
};
