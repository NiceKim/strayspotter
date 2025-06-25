const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env' });

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: process.env.DB_PASSWORD,
  database: 'strayspotter_database_test'
};


const generateRandomRow = () => {
  const daysAgo = Math.floor(Math.random() * 8);
  const date_taken = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];

  const district_no = Math.floor(Math.random() * 28) + 1;
  const district_name = `District ${district_no}`;
  const cat_status = ['good', 'normal', 'bad'][Math.floor(Math.random() * 3)];

  return [12.345678, 98.765432, date_taken, 12345, district_no, district_name, cat_status];
};

(async () => {
  const conn = await mysql.createConnection(dbConfig);

  const rows = Array.from({ length: 1000 }, generateRandomRow);
  const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = rows.flat();

  const insertSql = `
    INSERT INTO pictures
    (latitude, longitude, date_taken, postcode, district_no, district_name, cat_status)
    VALUES ${placeholders}
  `;

  res = await conn.execute(insertSql, values);
  await conn.end();

  console.log('✅ 1000 rows inserted using bulk insert.');
  console.log(res);
})();
