/**
 * db.js - Database interaction functions for StraySpotter
 * Database functions for interacting with the StraySpotter database.
 */

///////////////////////////////////////////////////////////////////////////////////////
// External Modules and Dependencies
///////////////////////////////////////////////////////////////////////////////////////
const mysql = require('mysql2');
const axios = require('axios');
const { postalData, NumbertoName } = require('./postal_data.js');
require('dotenv').config();

///////////////////////////////////////////////////////////////////////////////////////
// Ineternal Function
///////////////////////////////////////////////////////////////////////////////////////

/**
 * Updates an existing access token in the database.
 * 
 * @async
 * @param {Object} connection - The database connection object used to execute the query.
 * @param {Object} token_info - An object containing the token details to be updated.
  * @param {string} token_info.token_name - The name of the token to update.
  * @param {number} token_info.expire_date - The new expiration date of the token.
  * @param {string} token_info.access_token - The new access token.
 * @returns {string} - The name of the token that was updated
 */
async function updateAccessToken(connection, token_info) {
  const query = `UPDATE tokenStore SET expire_date = ?, access_token = ? WHERE token_name = ?`;
  const [results] = await connection.promise().query(
    query,
    [token_info.expire_date, token_info.access_token, token_info.token_name]
  );
  return results.token_name;
}

/**
 * Retrieves an access token from the database based on the token name.
 * 
 * @async
 * @param {Object} connection - The database connection object used to execute the query.
 * @param {string} token_name - The name of the token to be retrieved.
 * @returns {Object|null} - The token data if found, or `null` if no token is found.
 */
async function fetchAccessToken(connection, token_name) {
  const query = `SELECT * FROM tokenStore WHERE token_name = ? LIMIT 1`;
  const [results] = await connection.promise().query(query,
    [token_name]
  );
  if (results.length == 0) {
    return null;
  }
  return results[0];
}

/**
 * This function inserts a new token record into the `tokenStore` table with the provided token information.
 * 
 * @async
 * @param {Object} connection - The database connection object used to execute the query.
 * @param {Object} token_info - The token information to be saved in the database.
  * @param {string} token_info.token_name - The name of the token.
  * @param {number} token_info.expire_date - The expiration date of the token in Unix timestamp format.
  * @param {string} token_info.access_token - The access token string.
 * @returns {string} - The name of the token that was saved.
 */
async function saveAccessToken(connection, token_info) {
  const query =  `INSERT INTO tokenStore (token_name, expire_date, access_token) VALUES (?, ?, ?)`;
  const [results] = await connection.promise().query(
    query, 
    [token_info.token_name, token_info.expire_date, token_info.access_token]
  );
  return results.token_name;
}

/**
* Requests a new authentication token from the OneMap API
*
* @async
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
* @returns {Promise<Object>} A valid token object containing token_name, expire_date, and access_token
* @throws {Error} If token retrieval or refresh fails
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
          await saveAccessToken(connection, newToken);
      } else {
          // If there were token, update DB
          await updateAccessToken(connection, newToken);
      }
      token = newToken; 
  }
  return token;
}

/**
 * Performs reverse geocoding using OneMap API to retrieve the postal code for a given latitude and longitude.
 *
 * @async
 * @param {object} connection - The MySQL database connection object.
 * @param {number} latitude - The latitude coordinate.
 * @param {number} longitude - The longitude coordinate.
 * @returns {Promise<string>} The postal code if found
 * @throws Will log an error if the request fails or if latitude/longitude is null.
 * 
 */
async function reverseGeocoding(connection, latitude, longitude) {
  if (!latitude || !longitude) {
    throw new Error('Error reverseGeocoding: Null value');
  }
  let token = await getValidToken(connection);
  const requestURL = `https://www.onemap.gov.sg/api/public/revgeocode?location=${latitude},${longitude}&buffer=100&addressType=All&otherFeatures=N`;
  try {
  const response = await axios.get(requestURL, {
    headers: { 'Authorization': token.access_token }
  });
  return response.data.GeocodeInfo[0].POSTALCODE; // Return the postal code    
  } catch (error) {
    console.log(error)
  }
}


///////////////////////////////////////////////////////////////////////////////////////
// Exported function
///////////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a connection to the MySQL database.
 * 
 * This function establishes a connection to the MySQL database with the given configuration details,
 * such as host, user, database name, and password, which are used to connect to the 'strayspotter_database'.
 * 
 * @returns {object} The MySQL connection object used for interacting with the database.
 */
function createDBConnection() {
  const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: 'root',
    database: 'strayspotter_database',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306
  });
  return connection;
}

/**
 * Inserts picture metadata and additional data into the database.
 * @param {object} connection The MySQL connection object 
 * @param {Object} metadata - Object containing picture metadata:
 *   @property {string} latitude - Latitude of the picture.
 *   @property {string} longitude - Longitude of the picture.
 *   @property {string} date - Date when the picture was taken.
 * 
 * @param {Array} otherData - Array with two elements:
 *   @param {string} otherData[0] - Status string (e.g., "happy").
 *   @param {Object} otherData[1] - Address object:
 *     @property {string} postcode - Postal code.
 *     @property {string} districtNo - District number.
 *     @property {string} districtName - District name.
 * 
 * @returns {Promise<number>} Resolves with an object containing the inserted record ID (`insertId`), or rejects with an error.
 */
function insertDataToDB(connection, metadata, otherData) {
    let data = {
      latitude : metadata.latitude,
      longitude : metadata.longitude,
      date : metadata.date,
      postcode : otherData[1].postcode,
      district_no : otherData[1].districtNo,
      district_name : otherData[1].districtName,
      cat_status : otherData[0]
    }
    return new Promise((resolve, reject) => {
      connection.query(
        `INSERT INTO pictures (latitude, longitude, date_taken, postcode, 
        district_no, district_name, cat_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.latitude, data.longitude, data.date, data.postcode, data.district_no, data.district_name, data.cat_status],
        (err, results) => {
          if (err) { reject(err);} 
          else { resolve(results.insertId); }
        }
      )
    })
}

/**
 * Fetches the GPS coordinates (latitude and longitude) of a picture based on the provided ID.
 * 
 * @param {object} connection The MySQL connection object 
 * @param {number} id - The ID of the picture whose GPS coordinates are to be fetched.
 * @returns {Promise<Object[]>} A Promise that resolves with an array of objects with following properties:
 *   - {number} latitude 
 *   - {number} longitude
*/
function fetchGPSByID(connection, id) {
  return new Promise((resolve, reject) => {

    // A query to select data from the table
    connection.query(
      `SELECT latitude, longitude FROM pictures WHERE id = ?`,
      [id], // Pass `id` as an array for parameter binding
      function (err, results) {
        if (err) {
          return reject(err); // Reject the promise with the error
        }
        resolve(results); // Resolve the promise with the results
      }
    );
  });
}

/**
 * Converts GPS coordinates (latitude and longitude) to postal code and district information.
 *
 * @param {object} connection The MySQL connection object
 * @param {number} latitude The latitude of the location.
 * @param {number} longitude The longitude of the location.
 * 
 * @returns {Promise<Object>} A Promise that resolves with an object with the following properties:
 *   - {string} postcode
 *   - {number} districtNo
 *   - {string} districtName
 */
async function GPSToAddress(connection, latitude, longitude) {
  const postcode = await reverseGeocoding(connection, latitude, longitude);
  const districtData = postalData[postcode.substring(0,2)];
  return {
    postcode: postcode,
    districtNo: districtData.districtNo,
    districtName: districtData.districtName
  };
}


/**
 * Counts the number of pictures taken in a specific district within a given time period.
 * 
 * @param {object} connection The MySQL connection object
 * @param {number} districtNo - The district number to filter the pictures.
 * @param {"day" | "week" | "month"} range - The time range for counting pictures. 
 *      - "day": Counts pictures taken today.
 *      - "week": Counts pictures taken in the current week.
 *      - "month": Counts pictures taken in the current month.
 * @returns {Promise<number>} A promise that resolves to the count of pictures matching the criteria.
 */
function countPictures(connection, districtNo, range) {
  let query = "";
  
  if (range === "day") {
    query = `SELECT COUNT(id) as count FROM pictures WHERE date_taken = CURDATE() AND district_no = ${districtNo};`; //DEFAULT DAY
  } else if (range === "week") {
    query = `SELECT COUNT(id) as count FROM pictures 
    WHERE WEEK(date_taken) = WEEK(CURDATE())  
    AND YEAR(date_taken) = YEAR(CURDATE()) 
    AND district_no = ${districtNo};`;
  } else if (range === "month") {
    query = `SELECT COUNT(id) as count FROM pictures 
    WHERE MONTH(date_taken) = MONTH(CURDATE()) 
    AND YEAR(date_taken) = YEAR(CURDATE()) 
    AND district_no = ${districtNo};`;
  } else {
    throw new Error("invalidParameterError");
  }
  
  return new Promise((resolve, reject) => {
      connection.query(query, (err, results) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        const count = results[0].count;
        resolve(count);
      }
      });
  });
}

/**
 * Retrieves all data from the 'pictures' table in the database.
 * 
 * @returns {Promise<Array>} - A promise that resolves to an array containing all the records retrieved from the 'pictures' table.
 */
async function fetchAllDB() {
  const connection = createDBConnection();
  const query = `SELECT * FROM pictures;`;
  try {
    const [results] = await connection.promise().query(query);
    return results;
  } 
  finally {
      connection.end()
  }
}

///////////////////////////////////////////////////////////////////////////////////////
// Unused Function
///////////////////////////////////////////////////////////////////////////////////////

/**
 * Fetches the most recent photo IDs from the database.
  
 * @param {object} connection The MySQL connection object
 * @param {number} number The number of photo ID to fetch from DB
 * @returns {Promise<Object[]>} - A promise that resolves with an array of results, each containing a photo ID.
 */
function fetchRecentPhotoID(connection, number = 4) {
  
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT id FROM pictures ORDER BY id DESC LIMIT ?`, [number],
      (err, results) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(results);
        }
      }
    );
  });
}

module.exports = {
  insertDataToDB,
  fetchGPSByID,
  GPSToAddress,
  countPictures,
  fetchAllDB,
  createDBConnection,
  fetchRecentPhotoID
};