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
require('dotenv').config();

///////////////////////////////////////////////////////////////////////////////////////
// Ineternal Function
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
    `${process.env.ONEMAP_BASE_URL}/api/auth/post/getToken`,
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

/**
 * Creates a connection to the MySQL database.
 * 
 * This function establishes a connection to the MySQL database with the given configuration details,
 * such as host, user, database name, and password, which are used to connect to either the 'strayspotter_database'
 * or a test database depending on the value of the `test` parameter.
 * 
 * @param {boolean} test - A flag indicating whether to use the test database (`true`) or the main database (`false`).
 * @returns {Object} The MySQL connection object used for interacting with the database.
 */
function createDbConnection(test = false) {
  let databse_name;
  if (test) {
    databse_name = 'strayspotter_database_test';
  }
  else {
    databse_name = 'strayspotter_database';
  }
  const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: 'root',
    database: databse_name,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306
  });
  return connection;
}

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
 * Counts the number of pictures taken in a specific district within a given time period.
 * 
 * @param {Object} connection The MySQL connection object
 * @param {number} districtNo - The district number to filter the pictures
 *  If districtNo is 0, all pictures will be returned regardless of district
 * @param {"day" | "week" | "month"} timeFrame - The time range for counting pictures
 *      - "day": Counts pictures taken today
 *      - "week": Counts pictures taken in the current week
 *      - "month": Counts pictures taken in the current month
 * @returns {Promise<number>} A promise that resolves to the count of pictures matching the criteria
 * @throws {Error} Throws an error if range parameter is none of provided ranges
 */
async function countPictures(connection, districtNo, timeFrame) {
  let query = `SELECT COUNT(id) as count FROM pictures WHERE`;
  if (districtNo != 0) {
    query += ` district_no = ${districtNo} AND`
  }
  if (timeFrame === "day") {
    query += ` date_taken = CURDATE()`;
  } else if (timeFrame === "week") {
    query += ` WEEK(date_taken) = WEEK(CURDATE()) AND YEAR(date_taken) = YEAR(CURDATE())`;
  } else if (timeFrame === "month") {
    query += ` MONTH(date_taken) = MONTH(CURDATE()) AND YEAR(date_taken) = YEAR(CURDATE())`;
  } else {
    throw new Error('Invalid range parameter given');
  }
  const [result] = await connection.promise().query(query);
  return result[0].count;
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
  countPictures,
  fetchAllDb,
  createDbConnection,
  fetchRecentPhotoID,
  deleteByID
};