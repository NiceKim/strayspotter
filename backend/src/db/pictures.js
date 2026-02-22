/**
 * Database operations for pictures table.
 */
const { CustomError } = require('../../errors/CustomError.js');

async function insertPictureToDb(connection, data) {
  if (!data.date) {
    data.date = new Date();
  }
  const query = `INSERT INTO pictures
    (latitude, longitude, date_taken, district_no, cat_status) 
    VALUES (?, ?, ?, ?, ?)`;
  const [result] = await connection.query(query, [
    data.latitude,
    data.longitude,
    data.date,
    data.districtNo,
    data.catStatus
  ]);
  return result.insertId;
}

async function fetchById(connection, id) {
  const query = `SELECT * FROM pictures WHERE id = ?`;
  const [result] = await connection.query(query, [id]);
  if (result.length == 0) {
    throw new Error('No data found for the given ID');
  }
  return result[0];
}

async function getCurrentPictureCount(connection, districtNo) {
  let query = `
    SELECT 
      SUM(CASE WHEN DATE(date_taken) = CURDATE() THEN 1 ELSE 0 END) as day_count,
      SUM(CASE WHEN YEARWEEK(date_taken, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END) as week_count,
      SUM(CASE WHEN MONTH(date_taken) = MONTH(CURDATE()) AND YEAR(date_taken) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as month_count
    FROM pictures
  `;

  if (districtNo != 0) {
    query += ` WHERE district_no = ${districtNo}`;
  }

  const [result] = await connection.query(query);
  return {
    day: Number(result[0].day_count || 0),
    week: Number(result[0].week_count || 0),
    month: Number(result[0].month_count || 0)
  };
}

async function getDailyPictureCount(connection, { startDate, endDate, statusFilter }) {
  if (!startDate || !endDate) {
    throw new Error('Missing required parameter: startDate and endDate');
  }

  let query = `
    SELECT
      DATE_FORMAT(date_taken, '%Y-%m-%d') AS date_taken,
      district_no,
      COUNT(*) AS record_count
    FROM pictures
    WHERE date_taken BETWEEN ? AND ?
    AND district_no IS NOT NULL
  `;
  const params = [startDate, endDate];
  if (statusFilter !== undefined) {
    query += ` AND cat_status = ?`;
    params.push(statusFilter);
  }
  query += `
    GROUP BY date_taken, district_no
    ORDER BY date_taken, district_no;
  `;

  const [result] = await connection.query(query, params);
  return result;
}

async function getMonthlyPictureCount(connection, { month, statusFilter }) {
  if (!month) {
    throw new Error('Missing required parameter: month');
  }

  const params = month.split('-').map(Number);
  let query = `
    SELECT
      CONCAT(YEAR(date_taken), '-W', LPAD(WEEK(date_taken, 1), 2, '0')) AS year_week,
      district_no, 
      COUNT(*) AS record_count
    FROM pictures
    WHERE YEAR(date_taken) = ? AND MONTH(date_taken) = ?
    AND district_no IS NOT NULL
  `;
  if (statusFilter !== undefined) {
    query += ` AND cat_status = ?`;
    params.push(statusFilter);
  }
  query += `
    GROUP BY year_week, district_no
    ORDER BY year_week, district_no;
  `;

  const [result] = await connection.query(query, params);
  return result;
}

async function deleteById(connection, id) {
  const query = `DELETE FROM pictures WHERE id = ?`;
  const [result] = await connection.query(query, [id]);
  return result.affectedRows;
}

async function fetchGPSById(connection, id) {
  if (!id) {
    throw new CustomError('ID parameter missing', 400);
  }
  if (typeof id !== 'number' && !/^\d+$/.test(id)) {
    throw new CustomError('ID must be a number', 400);
  }
  const query = `SELECT latitude, longitude FROM pictures WHERE id = ?`;
  const [result] = await connection.query(query, [id]);
  if (result.length === 0) {
    throw new CustomError('Invalid Id', 404);
  }
  return result[0];
}

async function fetchRecentPhotoId(connection, photosToFetch = 4, photosToSkip = 0) {
  const query = `SELECT id FROM pictures ORDER BY id DESC LIMIT ? OFFSET ?`;
  const [result] = await connection.query(query, [photosToFetch, photosToSkip]);
  return result;
}

module.exports = {
  insertPictureToDb,
  fetchById,
  getCurrentPictureCount,
  getDailyPictureCount,
  getMonthlyPictureCount,
  deleteById,
  fetchGPSById,
  fetchRecentPhotoId
};
