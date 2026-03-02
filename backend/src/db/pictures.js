/**
 * Database operations for pictures table.
 */
const { CustomError } = require('../../errors/CustomError.js');

/**
 * Inserts a new picture record into the database.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {Object} data - Picture metadata to insert.
 * @param {number|null} data.latitude - Latitude where the picture was taken.
 * @param {number|null} data.longitude - Longitude where the picture was taken.
 * @param {Date} [data.date] - Date the picture was taken (defaults to now if missing).
 * @param {number|null} data.districtNo - District number or null if unknown.
 * @param {number} data.catStatus - Cat status value stored with the picture.
 * @returns {Promise<number>} ID of the newly created picture.
 */
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

/**
 * Fetches a picture record by its ID.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {number} id - Picture ID.
 * @returns {Promise<Object>} The picture row.
 * @throws {Error} If no record exists for the given ID.
 */
async function fetchById(connection, id) {
  const query = `SELECT * FROM pictures WHERE id = ?`;
  const [result] = await connection.query(query, [id]);
  if (result.length == 0) {
    throw new Error('No data found for the given ID');
  }
  return result[0];
}

/**
 * Aggregates picture counts for the current day, week, and month,
 * optionally filtered by district.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {number|null} [districtNo=null] - District number to filter by; when null, counts for all districts.
 * @returns {Promise<{day: number, week: number, month: number}>} Aggregated counts.
 */
async function getCurrentPictureCount(connection, districtNo = null) {
  let query = `
    SELECT 
      SUM(CASE WHEN DATE(date_taken) = CURDATE() THEN 1 ELSE 0 END) as day_count,
      SUM(CASE WHEN YEARWEEK(date_taken, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END) as week_count,
      SUM(CASE WHEN MONTH(date_taken) = MONTH(CURDATE()) AND YEAR(date_taken) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as month_count
    FROM pictures
  `;

  const params = [];
  if (districtNo !== null && districtNo !== undefined) {
    query += ` WHERE district_no = ?`;
    params.push(districtNo);
  }

  const [result] = await connection.query(query, params);
  return {
    day: Number(result[0].day_count || 0),
    week: Number(result[0].week_count || 0),
    month: Number(result[0].month_count || 0)
  };
}

/**
 * Returns daily picture counts per district for a given date range.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {Object} options - Query options.
 * @param {string} options.startDate - Start date in YYYY-MM-DD format.
 * @param {string} options.endDate - End date in YYYY-MM-DD format.
 * @param {number} [options.statusFilter] - Optional cat status filter.
 * @returns {Promise<Object[]>} Array of rows grouped by date and district.
 * @throws {Error} If startDate or endDate is missing.
 */
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

/**
 * Returns weekly-aggregated picture counts per district for a given month.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {Object} options - Query options.
 * @param {string} options.month - Target month in YYYY-MM format.
 * @param {number} [options.statusFilter] - Optional cat status filter.
 * @returns {Promise<Object[]>} Array of rows grouped by year-week and district.
 * @throws {Error} If month is missing.
 */
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

/**
 * Deletes a picture by its ID.
 *
 * @param {import('mysql2/promise').Pool} connection - MySQL connection pool.
 * @param {number} id - Picture ID.
 * @returns {Promise<number>} Number of affected rows.
 */
async function deleteById(connection, id) {
  const query = `DELETE FROM pictures WHERE id = ?`;
  const [result] = await connection.query(query, [id]);
  return result.affectedRows;
}

/**
 * Fetches GPS coordinates (latitude, longitude) for a given picture ID.
 *
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').Connection} connection - MySQL pool or connection.
 * @param {number|string} id - Picture ID to validate and query.
 * @returns {Promise<{latitude: number, longitude: number}>} GPS coordinates.
 * @throws {CustomError} If ID is missing, invalid, or not found.
 */
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

/**
 * Fetches recent picture IDs in descending order.
 *
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').Connection} connection - MySQL pool or connection.
 * @param {number} [photosToFetch=4] - Number of picture IDs to fetch.
 * @param {number} [photosToSkip=0] - Number of most recent entries to skip (offset).
 * @returns {Promise<Object[]>} Array of rows containing `id`.
 */
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
