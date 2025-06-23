/**
 * db.js - Database interaction functions for StraySpotter
 * Database functions for interacting with the StraySpotter database.
 */

///////////////////////////////////////////////////////////////////////////////////////
// External Modules and Dependencies
///////////////////////////////////////////////////////////////////////////////////////
const mysql = require('mysql2');
const axios = require('axios');
const { postalData } = require('./postal_data.js');
const { CustomError } = require('../errors/CustomError.js');

///////////////////////////////////////////////////////////////////////////////////////
// Internal Function
///////////////////////////////////////////////////////////////////////////////////////

/**
 * Updates an existing access token in the database.
 * 
 * @async
 * @param {Object} connection - The database connection object used to execute the query.
 * @param {Object} token - An object containing the token details to be updated.
  * @param {string} token.token_name - The name of the token to update.
  * @param {number} token.expire_date - The new expiration date of the token.
  * @param {string} token.access_token - The new access token.
 * @returns {string} - The name of the token that was updated
 */
async function updateAccessToken(connection, token) {
  const query = `UPDATE tokens SET expire_date = ?, access_token = ? WHERE token_name = ?`;
  const [results] = await connection.promise().query(
    query,
    [token.expire_date, token.access_token, token.token_name]
  );
  return results.token_name;
}

/**
 * Retrieves an access token from the database based on the token name.
 * 
 * @async
 * @param {Object} connection - The database connection object used to execute the query.
 * @param {string} tokenName - The name of the token to be retrieved.
 * @returns {Object|null} - The token data if found, or `null` if no token is found.
 */
async function fetchAccessToken(connection, tokenName) {
  const query = `SELECT * FROM tokens WHERE token_name = ?`;
  const [results] = await connection.promise().query(query,
    [tokenName]
  );
  if (results.length == 0) {
    return null;
  }
  return results[0];
}

/**
 * This function inserts a new token record into the `tokens` table with the provided token information.
 * 
 * @async
 * @param {Object} connection - The database connection object used to execute the query.
 * @param {Object} token - The token information to be saved in the database.
  * @param {string} token.token_name - The name of the token.
  * @param {number} token.expire_date - The expiration date of the token in Unix timestamp format.
  * @param {string} token.access_token - The access token string.
 * @returns {string} - The name of the token that was saved.
 */
async function saveAccessToken(connection, token) {
  const query =  `INSERT INTO tokens (token_name, expire_date, access_token) VALUES (?, ?, ?)`;
  const [results] = await connection.promise().query(
    query, 
    [token.token_name, token.expire_date, token.access_token]
  );
  return results.token_name;
}

/**
* Requests a new authentication token from the OneMap API
*
* @returns {Promise<Object>} Token data object with the following properties:
 *   - {string} access_token - JWT token for authentication
 *   - {string} expiry_timestamp - UNIX timestamp indicating when the token expires
*/
async function requestOneMapToken() {
    const response = await axios.post(
    `https://www.onemap.gov.sg/api/auth/post/getToken`,
    {
        email: process.env.ONEMAP_API_EMAIL,
        password: process.env.ONEMAP_API_PASSWORD,
    }
    );
    return response.data;
}

/**
* Retrieves or refreshes a valid OneMap API token
*
* @async
* @param {Object} connection - Database connection object
* @returns {Promise<Object>} A valid token object with the following properties:
 *   - {string} token_name - name of the token
 *   - {string} access_token - JWT token for authentication
 *   - {string} expiry_timestamp - UNIX timestamp indicating when the token expires
*/
async function getValidToken(connection) {
  // Get the token from the DB
  let token = await fetchAccessToken(connection, "onemap");
  
  const current_time_stamp = Math.floor(Date.now() / 1000);
  // Request for new Token if there are no token or expiered
  if (!token || current_time_stamp > token.expire_date) {
      const token_result = await requestOneMapToken();
      const newToken = {
          token_name: "onemap",
          expire_date: token_result.expiry_timestamp,
          access_token: token_result.access_token
      };
      if (!token) {
          // If there were no token, save it in DB
          saveAccessToken(connection, newToken);
      } else {
          // If there were token, update DB
          updateAccessToken(connection, newToken);
      }
      token = newToken; 
  }
  return token;
}


///////////////////////////////////////////////////////////////////////////////////////
// Exported function
///////////////////////////////////////////////////////////////////////////////////////

// Create a single connection pool for the app
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: 'root',
  database: process.env.IS_TEST === "true" ? 'strayspotter_database_test' : 'strayspotter_database',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
const poolPromise = pool.promise();

/**
 * Inserts picture metadata and additional data into the database.
 * @param {Object} connection The MySQL connection object 
 * @param {Object} data - Object containing picture's metadata and other information:
 *   - {string} latitude - Latitude of the picture.
 *   - {string} longitude - Longitude of the picture.
 *   - {string} date - Date when the picture was taken.
 *   - {string} status - Status string (e.g., "happy").
 *   - {string} postcode - Postal code.
 *   - {string} districtNo - District number.
 *   - {string} districtName - District name.
 * 
 * @returns {Promise<number>} Resolves with the inserted record ID.
 */
async function insertDataToDb (connection, data) {
  if (!data.date) {
    data.date = new Date();
  } 
  const query = `INSERT INTO pictures
    (latitude, longitude, date_taken, postcode, district_no, district_name, cat_status) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const [result] = await connection.promise().query(
    query, 
    [data.latitude, data.longitude, data.date, data.postcode, data.districtNo, data.districtName, data.catStatus],
  );
  return result.insertId;
}

/**
 * Fetches all metadata of a picture based on the provided ID.
 * 
 * @param {Object} connection - The MySQL connection object.
 * @param {number} id - The ID of the picture whose metadata is to be fetched.
 * @returns {Promise<Object>} A Promise that resolves with an object containing:
 *   - {number} id - Unique identifier of the picture.
 *   - {number} latitude - Latitude where the picture was taken.
 *   - {number} longitude - Longitude where the picture was taken.
 *   - {string} date_taken - Date when the picture was taken (YYYY-MM-DD format).
 *   - {number} postcode - Postcode of the location.
 *   - {number} district_no - Numeric district code.
 *   - {string} district_name - Name of the district (up to 20 characters).
 *   - {string} cat_status - Status of the cat (e.g., "stray", "owned").
 * @throws {Error} Throws an error if no data is found for the given ID.
 */
async function fetchByID(connection, id) {
  const query = `SELECT * FROM pictures WHERE id = ?`;
  const [result] = await connection.promise().query(
    query,
    [id]
  );
  if (result.length == 0) {
    throw new Error('No data found for the given ID');
  }
  return result[0];
}

/**
 * Converts GPS coordinates (latitude and longitude) to postal code and district information.
 *
 * @param {Object} connection The MySQL connection object
 * @param {number} latitude The latitude of the location.
 * @param {number} longitude The longitude of the location.
 * 
 * @returns {Promise<Object>} A Promise that resolves with an object with the following properties:
 *   - {string} postcode
 *   - {number} districtNo
 *   - {string} districtName
 */
async function reverseGeocode(connection, latitude, longitude) {
  if (!latitude || !longitude) {
    throw new Error('Error reverseGeocoding: Null value');
  }
  let token = await getValidToken(connection);
  const requestURL = `https://www.onemap.gov.sg/api/public/revgeocode?location=${latitude},${longitude}&buffer=100&addressType=All&otherFeatures=N`;
  const response = await axios.get(requestURL, {
    headers: { 'Authorization': token.access_token }
  });
  const postcode = response.data.GeocodeInfo[0].POSTALCODE;     
  const districtData = postalData[postcode.substring(0,2)];

  return {
    postcode: Number(postcode),
    districtNo: districtData.districtNo,
    districtName: districtData.districtName
  };
}

/**
 * Retrieves the count of pictures taken within the current day, week, or month,
 * optionally filtered by district.
 *
 * @param {Object} connection The MySQL connection object.
 * @param {number} districtNo The district number to filter pictures by.
 *                          If `0`, pictures from all districts will be counted for the specified time frame.
 * @param {"day" | "week" | "month"} timeFrame Specifies the granularity of the "current" period:
 *      - "day": Counts pictures taken on the current calendar day.
 *      - "week": Counts pictures taken within the current calendar week (e.g., Sunday to Saturday, depending on DB settings).
 *      - "month": Counts pictures taken within the current calendar month.
 * @returns {Promise<number>} A promise that resolves to the total count of pictures
 *                            matching the district and current time frame criteria.
 * @throws {Error} Throws an error if the `timeFrame` parameter is not one of the
 *                 allowed values ('day', 'week', 'month').
 */
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

  const [result] = await connection.promise().query(query);
  return {
    day: Number(result[0].day_count || 0),
    week: Number(result[0].week_count || 0),
    month: Number(result[0].month_count || 0)
  };
}


async function getDailyPictureCount(connection, {startDate, endDate, statusFilter = 'all'}) {
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
  `;
  const params = [startDate, endDate];
  if (statusFilter !== 'all') {
    query += ` AND cat_status = ?`;
    params.push(statusFilter);
  }
  query += `
    GROUP BY date_taken, district_no
    ORDER BY date_taken, district_no;
  `;

  const [result] = await connection.promise().query(query, params);
  return result;
}

async function getMonthlyPictureCount(connection, {month, statusFilter = 'all'}) {
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
  `;
  if (statusFilter !== 'all') {
    query += ` AND cat_status = ?`;
    params.push(statusFilter);
  }
  query += `
    GROUP BY year_week, district_no
    ORDER BY year_week, district_no;
  `;

  const [result] = await connection.promise().query(query, params);
  return result;
}

/**
 * Retrieves all data from the 'pictures' table in the database.
 * 
 * @param {Object} connection The MySQL connection object
 * @returns {Promise<Object[]>} A promise that resolves to an array containing all the records retrieved from the 'pictures' table
 */
async function fetchAllDb(connection) {
  const query = `SELECT * FROM pictures;`;
  const [results] = await connection.promise().query(query);
  return results;
}

/**
 * Deletes the data from the 'pictures' table based on the given ID.
 * 
 * @param {Object} connection The MySQL connection object 
 * @param {number} id The ID of the picture to be deleted
 * 
 * @returns {Promise<number>} The number of rows affected by the deletion. If no rows are deleted, 0 is returned.
 */
async function deleteByID(connection, id) {
  const query = `DELETE FROM pictures WHERE id = ?`;
  const [result] = await connection.promise().query(
    query,
    [id]
  );
  return result.affectedRows;
}

/**
 * Fetches GPS coordinates (latitude and longitude) from the database for a given ID.
 * 
 * @param {object} connection - The database connection object with promise support.
 * @param {number} id - The ID to look up in the database.
 * 
 * @returns {Promise<{latitude: number, longitude: number}>} - Resolves with the GPS data object.
 * 
 * @throws {CustomError} Throws a CustomError with status 400 if ID is missing or not a number.
 * @throws {CustomError} Throws a CustomError with status 404 if no record found for the given ID.
 */
async function fetchGPSByID(connection, id) {
  if (!id) {
    throw new CustomError("ID parameter missing", 400)
  }
  if (typeof id !== "number" && !/^\d+$/.test(id)) {
    throw new CustomError("ID must be a number", 400);
  }
  const query = `SELECT latitude, longitude FROM pictures WHERE id = ?`;
  const [result] = await connection.promise().query(
    query,
    [id]
  );
  if (result.length === 0) {
    throw new CustomError("Invalid ID", 404)
  }
  return result[0];
}

///////////////////////////////////////////////////////////////////////////////////////
// Unused Function
///////////////////////////////////////////////////////////////////////////////////////

/**
 * Fetches the most recent photo IDs from the database.
  
 * @param {Object} connection The MySQL connection object
 * @param {number} photosToFetch The number of photo IDs to fetch from DB, 4 if no number given
 * @param {number} photosToSkip The number of photo IDs to skip
 * @returns {Promise<Object[]>} - A promise that resolves with an array of results, each containing a photo ID.
 */
async function fetchRecentPhotoID(connection, photosToFetch = 4, photosToSkip = 0) {
  const query = `SELECT id FROM pictures ORDER BY id DESC LIMIT ? OFFSET ?`;
  const [result] = await connection.promise().query(
    query,
    [photosToFetch, photosToSkip]
  );
  return result;
}

module.exports = {
  insertDataToDb,
  fetchByID,
  reverseGeocode,
  getCurrentPictureCount,
  getDailyPictureCount,
  getMonthlyPictureCount,
  fetchAllDb,
  fetchRecentPhotoID,
  deleteByID,
  fetchGPSByID,
  pool: poolPromise
};