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
 * Counts the number of pictures taken in a specific district within a given time period.
 * 
 * @param {number} districtNo - The district number to filter the pictures.
 * @param {"day" | "week" | "month"} type - The time range for counting pictures. 
 *      - "day": Counts pictures taken today.
 *      - "week": Counts pictures taken in the current week.
 *      - "month": Counts pictures taken in the current month.
 * @returns {Promise<number>} A promise that resolves to the count of pictures matching the criteria.
 */
function countPicturesLocation(districtNo, type) {
  const connection = createDBConnection();
  let query = "";
  
  if (type === "day") {
    query = `SELECT COUNT(id) as count FROM pictures WHERE date_taken = CURDATE() AND district_no = ${districtNo};`; //DEFAULT DAY
  }
  if (type === "week") {
    query = `SELECT COUNT(id) as count FROM pictures 
    WHERE WEEK(date_taken) = WEEK(CURDATE())  
    AND YEAR(date_taken) = YEAR(CURDATE()) 
    AND district_no = ${districtNo};`;
  } else if (type === "month") {
    query = `SELECT COUNT(id) as count FROM pictures 
    WHERE MONTH(date_taken) = MONTH(CURDATE()) 
    AND YEAR(date_taken) = YEAR(CURDATE()) 
    AND district_no = ${districtNo};`;
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
      connection.end();
      });
  });
}

/**
 * Updates an existing access token in the database.
 * 
 * @async
 * @param {Object} connection - The database connection object used to execute the query.
 * @param {Object} token_info - An object containing the token details to be updated.
  * @param {string} token_info.token_name - The name of the token to update.
  * @param {number} token_info.expire_date - The new expiration date of the token.
  * @param {string} token_info.access_token - The new access token.
 * @returns {Object} - The result of the query execution.
 */
async function updateAccessToken(connection, token_info) {
  const query = `UPDATE tokenStore SET expire_date = ?, access_token = ? WHERE token_name = ?`;
  const [results] = await connection.promise().query(query,
    [token_info.expire_date, token_info.access_token, token_info.token_name]
  );
  return results;
}

/**
 * Retrieves an access token from the database based on the token name.
 * 
 * @async
 * @param {Object} connection - The database connection object used to execute the query.
 * @param {string} token_name - The name of the token to be retrieved.
 * @returns {Object|null} - The token data if found, or `null` if no token is found.
 */
async function getAccessToken(connection, token_name) {
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
 * @throws {Error} - Throws an error if the query execution fails.
 */
async function saveAccessToken (connection, token_info) {
  const query =  `INSERT INTO tokenStore (token_name, expire_date, access_token) VALUES (?, ?, ?)`;
  try {
    const [results] = await connection.promise().query(query, 
      [token_info.token_name, token_info.expire_date, token_info.access_token]
    );
    return results.token_name;  
  } catch (err) {
      throw err;
  }
}

/**
* Requests a new authentication token from the OneMap API
*
* @async
* @returns {Promise<Object>} Token data object with the following properties:
 *   - {string} access_token - JWT token for authentication
 *   - {string} expiry_timestamp - UNIX timestamp indicating when the token expires
* @throws {Error} If the API request fails or returns an error
*/
async function requestOneMapToken() {
  try {
      const response = await axios.post(
      `${process.env.ONEMAP_BASE_URL}/api/auth/post/getToken`,
      {
          email: process.env.ONEMAP_API_EMAIL,
          password: process.env.ONEMAP_API_PASSWORD,
      }
      );
      const token_data = response.data;
      return token_data;
  } catch (error) {
    throw error;
  }
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
  let token = await getAccessToken(connection, "onemap");
  
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
 * API Error Codes 
 * 400 - Please send the access token in the request header as a bearer token.
 * 400 - Your provided location is empty.
 * 400 - Your provided location is invalid.
 * 401 - Token has expired: Session expired. Please refresh your token (if still within refresh window) or re-login.
 * 401 - Invalid token: Could not decode token: The token xxx; is an invalid JWS.
 * 403 - Access Forbidden. GET access to component 'xxx' of service 'xxx' is not allowed by this user's role.
 * 429 - API limit(s) exceeded.
*/
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
  const response = await axios.get(requestURL, {
    headers: { 'Authorization': token.access_token }
  });
  return response.data.GeocodeInfo[0].POSTALCODE; // Return the postal code    
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
 * TODO: THE ADDRESS AND CAT STAUTS TO BE UPDATED
 */
/**
 * Inserts picture metadata and location data into the database.
 * If no result is provided, defaults to 'none' for district information and '0' for postcode and district number.
 * If result is provided, updates with the appropriate postal information and sets cat status to 1.
 * 
 * @param {Object} metadata - Metadata of the picture, containing latitude, longitude, and date.
 * @param {Object|null} otherData - Address result, status (can be null).
 * @returns {Promise} Resolves with the inserted record ID or rejects with an error.
 */
function insertDataToDB(metadata, otherData) {
    const connection = createDBConnection()
    let data = {
      latitude : metadata.latitude,
      longitude : metadata.longitude,
      date : metadata.date ?? "9999-12-30"
    }
    if (!otherData) {
      data.postcode = "0";
      data.district_no = "0";
      data.district_name = "none";
      data.cat_status = "good";
    } else {
      data.postcode = otherData[1].postcode;
      data.district_no = otherData[1].districtNo;
      data.district_name = otherData[1].districtName;
      data.cat_status = otherData[0];
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
          connection.end();
        }
      )
    })
}

/**
 * Fetches the GPS coordinates (latitude and longitude) of a picture based on the provided ID.
 * 
 * @param {number} id - The ID of the picture whose GPS coordinates are to be fetched.
 * @returns {Promise} Resolves with the fetched coordinates or rejects with an error.
 */
function fetchGPSByID(id) {
  return new Promise((resolve, reject) => {
    const connection = createDBConnection();

    // A query to select data from the table
    connection.query(
      `SELECT latitude, longitude FROM pictures WHERE id = ?`,
      [id], // Pass `id` as an array for parameter binding
      function (err, results) {
        // Ends the connection
        connection.end();
        if (err) {
          return reject(err); // Reject the promise with the error
        }
        resolve(results); // Resolve the promise with the results
      }
    );
  });
}

/**
 * Creates a report based on the total number of pictures and the count per district for a given request type.
 * 
 * @param {"day" | "week" | "month"} request_type - The time range for counting pictures.
 * @returns {Promise<string>} Resolves with the generated HTML report.
 */
async function createReport(request_type) {
  let report = "";

  let total = await countPicturesLocation(0, request_type);
  report = report.concat(`TOTAL NUMBER: ${total}<br><br>`);

  for (let district_i = 1; district_i <= 28; district_i++) {
    const district_name = NumbertoName[district_i];
    const count = await countPicturesLocation(district_i, request_type);
    report = report.concat(`${district_name}: ${count}<br>`);
  }
  return report;
}

/**
 * Converts GPS coordinates (latitude and longitude) to postal code and district information.
 * 
 * @param {number} latitude - The latitude of the location.
 * @param {number} longitude - The longitude of the location.
 * @returns {Object} An object in the format {postcode, districtNo, districtName}
 */
async function GPSToAddress(latitude, longitude) {
  const connection = createDBConnection()
  try {
  const postcode = await reverseGeocoding(connection, latitude, longitude);
  const districtData = postalData[postcode.substring(0,2)];
  return {
    postcode: postcode,
    districtNo: districtData.districtNo,
    districtName: districtData.districtName
  };
  } catch(err) {
    throw err; 
  } finally {
    connection.end();
  }
}

/**
 * Retrieves all data from the 'pictures' table in the database.
 * 
 * @param {Object} connection - The MySQL database connection object.
 * @returns {Promise<Array>} - A promise that resolves to an array containing all the records retrieved from the 'pictures' table.
 */
async function fetchAllDB(connection) {
  const query = `SELECT * FROM pictures;`;
  try {
    const [results] = await connection.promise().query(query);
    return results;
  } catch(err) {
    throw err;
  }
}

///////////////////////////////////////////////////////////////////////////////////////
// Unused Function
///////////////////////////////////////////////////////////////////////////////////////

/**
 * Fetches the most recent photo IDs from the database.
 * 
 * @param {number} [number=4] - The number of recent photo IDs to retrieve (default is 4).
 * @returns {Promise<Object[]>} - A promise that resolves with an array of results, each containing a photo ID.
 */
function fetchRecentPhotoID(number = 4) {
  const connection = createDBConnection();
  
  return new Promise((resolve, reject) => {
    // A query to fetch recent photo ids from the DB
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
    connection.end();
  });
}

/**
 * Count the number of pictures taken today in the database.
 *  
 * @returns {Promise<number>} A promise that resolves to the count of pictures taken today.
 */
function countPicturesToday() {
  const connection = createDBConnection();
  
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(id) as count FROM pictures WHERE date_taken = CURDATE();`;
    connection.query(query, (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        reject(err);
      } else { 
        resolve(results[0].count); 
      }
    });
    connection.end();
  });
}

module.exports = {
  insertDataToDB,
  fetchGPSByID,
  GPSToAddress,
  createReport,
  createDBConnection,
  fetchAllDB,

  reverseGeocoding,
  getAccessToken,
  requestOneMapToken,
  saveAccessToken,
  updateAccessToken,
  getValidToken
};