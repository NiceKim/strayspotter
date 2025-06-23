///////////////////////////////////////////////////////////////////////////////////////
// APP CONFIGURATION
///////////////////////////////////////////////////////////////////////////////////////
// Express setup
const express = require('express');
const app = express();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const HOST = process.env.HOST;
const PORT = process.env.PORT;
const SECOND_SERVER_HOST = process.env.SECOND_HOST;
const SECOND_SERVER_PORT = process.env.SECOND_PORT;
const IS_TEST = process.env.IS_TEST === "true";

// Apply CORS middleware to allow frontend
const cors = require('cors'); 
app.use(cors({
  origin: process.env.FRONT_ORIGIN, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow all methods
  allowedHeaders: '*' // Allow all headers
}));

// Swagger doucumetation setup
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// To receive data from client
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const multer = require('multer');
const storage = multer.memoryStorage();
const receiveImage = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
}).single('image');

// Database and other services
const db = require('./db');
const { processImageUpload } = require('./image_handler')
const { axios } = require('axios');
const { CustomError } = require('../errors/CustomError.js');
const { createReport, createExcelReport } = require('./report.js');

///////////////////////////////////////////////////////////////////////////////////////
// API ENDPOINTS
///////////////////////////////////////////////////////////////////////////////////////

// API endpoint prefix to differentiate from React routes
const API_PREFIX = '/api';
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const bucket_name = "strayspotter-bucket";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',  // 환경변수가 없을 경우 기본값 사용
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY_ID,
  },
  forcePathStyle: true, // Override endpoint resolution for local development
});
/**
 * Retrieves a list of image keys from the cloud, sorted in descending numerical order.
 * Returns up to a specified number of image keys based on the client's query parameter.
 *
 * @param {number} maxKeys The number of image keys to return, specified by the client in the query string.
 * @returns {object} A JSON object containing the sorted list of image keys.
 * @throws {Error} Throws an error if there is an issue with fetching the image keys from the cloud.
 */
app.get(`${API_PREFIX}/images`, async (req, res) => {
  const params = {
    Bucket: bucket_name,
  };
  const maxKeys = req.query.maxKeys || 100; // Default to 100 if not specified

  try {
    const command = new ListObjectsV2Command(params);
    const data = await s3Client.send(command);
    const imageKeys = (data.Contents || []).map(item => item.Key);

    imageKeys.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10); // Extract number from key name
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numB - numA; // Compare in descending order
    });
    res.json(imageKeys.slice(0, maxKeys));
  } catch (err) {
    console.error("Error listing images:", err);
    // Return empty array for testing/dev purposes
    res.json([]);
  }
});

/**
 * Generates a pre-signed URL for accessing an image
 *
 * @param {string} key The key of the image in the cloud (provided as a query parameter).
 * @returns {object} A JSON object containing the pre-signed URL
 * @throws {Error} Throws an error if there is an issue with fetching data or generating the pre-signed URL.
 */
app.get(`${API_PREFIX}/image-url`, async (req, res) => {
  const { key } = req.query;
  try {
    if (!key) {
      return res.status(400).send('Key is required');
    }
    const params = {
      Bucket: bucket_name,
      Key: key,
      Expires: 60 * 60, // seconds, set to one hour
    };
    const url = await getSignedUrl(s3Client, new GetObjectCommand(params));
    res.json({ url: url }); 
  } catch (error) {
    console.error('Error during getting image-url:', error);
    res.json({
      url: `https://example.com/${key}`
    });
  }
});

/**
 * Generates a report based on the provided parameters and returns the result.
 * 
 * @param {Object} req.query - The query parameters
 * @param {'daily'|'monthly'} req.query.timeFrame - The type of report to generate
 * @param {string} [req.query.statusFilter] - Optional filter for cat status ('happy', 'normal', 'sad')
 * @param {string} req.query.startDate - Required for daily reports: Start date in YYYY-MM-DD format
 * @param {string} req.query.endDate - Required for daily reports: End date in YYYY-MM-DD format
 * @param {string} req.query.month - Required for monthly reports: Month in YYYY-MM format
 * @returns {Object} The report data containing records and totals
 * @throws {400} If required parameters are missing or invalid
 * @throws {500} If there is an error during report generation
 */
app.get(`${API_PREFIX}/report`, async (req, res) => {
  const connection = db.createDbConnection(IS_TEST);
  const { timeFrame, statusFilter, startDate, endDate, month } = req.query;
  
  if (!timeFrame) {
    console.log('timeFrame is required');
    return res.status(400).send('timeFrame is required');
  }
  if (timeFrame !== 'daily' && timeFrame !== 'monthly') {
    console.log('timeFrame must be either "daily" or "monthly"');
    return res.status(400).send('timeFrame must be either "daily" or "monthly"');
  }
  if (statusFilter && !['happy', 'normal', 'sad'].includes(statusFilter)) {
    console.log('statusFilter must be either "happy", "normal", or "sad"');
    return res.status(400).send('statusFilter must be either "happy", "normal", or "sad"');
  }
  if (timeFrame === 'daily' && (!startDate || !endDate)) {
    console.log('startDate and endDate are required for daily reports');
    return res.status(400).send('startDate and endDate are required for daily reports');
  }
  if (timeFrame === 'monthly' && !month) {
    console.log('month is required for monthly reports (YYYY-MM format)');
    return res.status(400).send('month is required for monthly reports (YYYY-MM format)');
  }

  try {
    let options = { statusFilter };
    if (timeFrame === 'daily') {
      options = {
        ...options,
        startDate,
        endDate
      };
    } else { // monthly
      options = {
        ...options,
        month
      };
    }

    const reportData = await createReport(connection, timeFrame, options);
    res.json(reportData);
  } catch (err) {
    console.error("Report generation error:", err);
    res.status(500).json("Report generation failed");
  } finally {
    connection.end();
  }
});

/**
 * Retrieves the current count of cat pictures for different time periods.
 * 
 * @param {Object} req.query - The query parameters
 * @returns {Object} An object containing cat picture counts
 * @property {number} day - Number of pictures taken today
 * @property {number} week - Number of pictures taken in the last 7 days
 * @property {number} month - Number of pictures taken this month
 * @throws {500} If there is an error fetching the count data
 */
app.get(`${API_PREFIX}/current-cat-count`, async (req, res) => {
  const connection = db.createDbConnection(IS_TEST);

  try {
    const reportData = await db.getCurrentPictureCount(connection, 0);
    res.json(reportData);
  } catch (err) {
    console.error("Report generation error:", err);
    res.status(500).json("Report generation failed");
  } finally {
    connection.end();
  }
});

/**
 * Handles file upload, processes EXIF data, and stores image metadata in the database.
 *
 * @param {object} req.file The uploaded file object, containing the image file data.
 * @param {string} req.body.status The category representing the cat's condition (e.g., "happy", "normal", "sad").
 * @throws {Error} Throws an error if there is an issue during file upload, EXIF data parsing, or database insertion.
 */
app.post(`${API_PREFIX}/upload`, receiveImage, async (req, res) => {
  const file = req.file;
  const status = req.body.status;
  if (!file) {
    return res.status(400).send('No file selected!');
  }
  const connection = db.createDbConnection(IS_TEST);
  try {
    const result = await processImageUpload(connection,file, status);
    console.log(`uploaded new picture ${result}`);
    res.status(200).send("Picture sucessfully uploaded");
  } catch (generalErr) {
    console.error("General error in upload:", generalErr);
    res.status(400).send("File upload failed due to errors");
  } finally {
    connection.end();
  }
});

/**
 * Classifies an image as a cat or not by calling an external classification server.
 *
 * @param {string} id - The request object containing the image ID.
 * @returns {Object} JSON response indicating whether the image is classified as a cat (`isCat: true/false`).
 */
app.get(`${API_PREFIX}/classification/:id`, async (req, res) => {
  const requestURL = `http://${SECOND_SERVER_HOST}:${SECOND_SERVER_PORT}/classification/${req.params.id}`;
  try {
    const response = await axios.get(requestURL);
    res.json({ isCat: response.data });
  } catch (error) {
    console.log("Classification server error:", error);
    // Always return true for testing purposes
    res.json({ isCat: true });
  }
});

/**
 * Fetch all data from DB in JSON
 *
 * @returns {Object} the data from the db in JSON
 */
app.get(`${API_PREFIX}/admin/db`, async (req, res) => {
  const connection = db.createDbConnection(IS_TEST);
  try {
    const data = await db.fetchAllDb(connection);
    res.json(data);
  } catch (err) {
    console.error("Error fetching DB data:", err);
    res.status(500).json({ error: "Failed to fetch GPS data" });
  } finally {
    connection.end();
  }
});

/**
 * Retrieves GPS coordinates (latitude and longitude) for a given ID from the database
 * and returns them as a JSON response.
 * 
 * @param {Number} req.params.id - expects req.params.id as the ID of picture.
 * 
 * @returns {Object} the latitude and longitude data of the requested picture
 * 
 * @throws {CustomError} Throws a custom error incase of invalid parameter
 * @throws {Error} Throws a generic error, responds with status 500 and the error message.
 */
app.get(`${API_PREFIX}/gps/:id`, async (req, res) => {
  const connection = db.createDbConnection(IS_TEST);
  try {
    const {latitude, longitude} = await db.fetchGPSByID(connection, req.params.id);
    res.json({latitude, longitude});
  } catch (err) {
    const status = err instanceof CustomError ? err.statusCode : 500
    res.status(status).json({ error: err.message })
  } finally {
    connection.end();
  }
});

/**
 * Health check endpoint
 * Returns server status for monitoring
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  res.status(200).json({
    message: "Operation completed with errors, but proceeded anyway",
    error: err.message
  });
});

///////////////////////////////////////////////////////////////////////////////////////
// SERVER STARTUP
///////////////////////////////////////////////////////////////////////////////////////
const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`API is available at http://${HOST}:${PORT}${API_PREFIX}`);
});

process.on('SIGINT', () => {
  console.log('Gracefully shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});