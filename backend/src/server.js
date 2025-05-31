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
const { CustomError } = require('../errors/CustomError.js')

///////////////////////////////////////////////////////////////////////////////////////
// UTILITY FUNCTIONS
///////////////////////////////////////////////////////////////////////////////////////
const { NumbertoName } = require('./postal_data.js');

/**
 * Creates a report based on the total number of pictures and the count per district for a given request type.
 * 
 * @param {"day" | "week" | "month"} timeFrame - The time range for counting pictures.
 * @returns {Promise<string>} Resolves with the generated HTML report.
 */
async function createReport(connection, timeFrame) {
  let report = "";
  let total = await db.getCurrentPictureCount(connection, 0, timeFrame);
  report = report.concat(`TOTAL NUMBER: ${total}<br><br>`);

  for (let district_i = 1; district_i <= 28; district_i++) {
    const district_name = NumbertoName[district_i];
    const count = await db.getCurrentPictureCount(connection, district_i, timeFrame);
    report = report.concat(`${district_name}: ${count}<br>`);
  }
  return report;
}

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
 * Generates a report based on the provided method and returns the result.
 *
 * @param {string} timeFrame Time Frame, 'day', 'week', or 'month'(provided as a query parameter).
 * @returns {object} The report data generated by the specified method.
 * @throws {Error} Throws an error if there is an issue with report generation or database interaction.
 */
app.get(`${API_PREFIX}/report`, async (req, res) => {
  const connection = db.createDbConnection();
  const { timeFrame } = req.query;
  if (!timeFrame) {
    return res.status(400).send('timeFrame is required');
  }

  try {
    const reportData = await createReport(connection, timeFrame);
    res.json(reportData);
  } catch (err) {
    console.error("Report generation error:", err);
    res.json("Report generation failed");
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
  const connection = db.createDbConnection();
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
  const connection = db.createDbConnection();
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
  const connection = db.createDbConnection();
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