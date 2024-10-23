/*
Project Title : StraySpotter
Project Description : A web service that utilizes Wasabi cloud, for people to share stray cat pictures.
  The data will be analysed to provide the insight of the stray cats.
Member : KIM JOWOON, KELVIN, ALEX
Date Started : 21.10.2024
Current version : 2.0
Version date : 24.10.2024
*/


const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, CreatePresignedUrlCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const {Readable} = require('stream');
const crypto = require('crypto');
const exifr = require('exifr');
const heicConvert = require('heic-convert');
const fs = require('fs');
const {exiftool} = require('exiftool-vendored');
const tmp = require('tmp');
const mysql = require('mysql2');

require('dotenv').config();

const access_key_id = process.env.ACCESS_KEY_ID;
const secret_access_key_id = process.env.SECRET_ACCESS_KEY_ID;

const bucket_name = "catphotos"
const HOST = "192.168.6.17";

const app = express();

const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage }).single('image'); // Name of the input field
const client_folder_name = "public";

var fileData;

const s3Client = new S3Client({
  region: 'ap-southeast-1', // Region, adjust as needed
  endpoint: 'https://s3.ap-southeast-1.wasabisys.com', // Wasabi endpoint
  credentials: {
    accessKeyId: access_key_id, // Your Wasabi access key
    secretAccessKey: secret_access_key_id, // Your Wasabi secret key
  },
});

async function extractMetadata(file) {
  try {
      // Extract all data
      let output = await exifr.parse(file, true);
      
      if (output === undefined) {
          console.log("Metadata undefined");
      } else {
          console.log("Data retrieved!");
      }
      return output;
  } catch (error) {
      console.error('Error reading metadata:', error);
      return null;
  }
}


async function convertHeicToJpg(inputBuffer) {

  // Extract EXIF data
  const exifData = await exifr.parse(inputBuffer);

  // Convert HEIC to JPG
  const jpgBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG', // Output format
      quality: 1, // Quality from 0 to 1
  });

  // Optionally, you can write EXIF data back to the JPG file
  // (Use a library like exiftool-vendored for writing)

  // const tempJpgPath = tmp.tmpNameSync({ postfix: '.jpg' });
    
  // try {
  //     // Write the original JPEG buffer to the temporary file
  //     fs.writeFileSync(tempJpgPath, jpgBuffer);

  //     // Write the EXIF data to the temporary file
  //     await exiftool.write(tempJpgPath, exifData);

  //     // Read the modified JPEG file back into a buffer
  //     const modifiedJpegBuffer = fs.readFileSync(tempJpgPath);

  //     return modifiedJpegBuffer; // Return the modified JPEG buffer
  // } finally {
  //     // Cleanup: remove the temporary file
  //     fs.unlinkSync(tempJpgPath);
  // }

  return jpgBuffer; // Return the JPG buffer
}

// Function to create a 32-bit hash from a string
function create32BitHash(input) {
  // Create a SHA-256 hash of the input
  const hash = crypto.createHash('sha256');
  hash.update(input);

  // Get the full hash as a Buffer
  const fullHash = hash.digest();

  // Convert the first 4 bytes (32 bits) of the hash to a hexadecimal string
  const thirtyTwoBitHash = fullHash.readUInt32BE(0).toString(16).padStart(8, '0');

  return thirtyTwoBitHash;
}

function uploadData(fileData, res, unique_id) {

    console.log(fileData);
    // const providedFilename = req.body.filename; - For user input / Not used anyomre
    const params = {
      Bucket: bucket_name, // Your Wasabi bucket name
      Key: unique_id, // File name in S3
      Body: fileData,
    };

    try {
      const command = new PutObjectCommand(params);
      const data = s3Client.send(command);
      res.send(`File uploaded successfully at https://${bucket_name}.s3.wasabisys.com/${params.Key}`);
    } catch (s3Err) {
      return res.status(500).send(s3Err.message);
    }
}

// THE ADDRESS AND CAT STAUTS TO BE UPDATED
function insert_data(metadata) {

  let data = {
    latitude : metadata.latitude,
    longitude : metadata.longitude,
    date : metadata.CreateDate ?? "9999-12-30",
    postcode : 123,
    district_no : 12,
    district_name : 'TEST',
    cat_status : 1,
  };
  // if (metadata.GPSDateStamp) {
  //   data.date = metadata.GPSDateStamp.replaceAll(':','-');
  // } else if (metadata.CreateDate) {
  //   data.date = metadata.CreateDate;
  // }

  const connection = createDBConnection()
  // A query to insert data into table
  
  return new Promise((resolve, reject) => {
    connection.query(
      `INSERT INTO pictures (latitude, longitude, date_taken, postcode, 
      district_no, district_name, cat_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.latitude, data.longitude, data.date, data.postcode, data.district_no, data.district_name, data.cat_status]
      ,(err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results.insertId);
        }
        connection.end();
      })
  })
}

function select_data(limit) {
  const connection = createDBConnection()
  // A query to insert data into table
  connection.query(
    `SELECT * FROM pictures LIMIT ` + limit
    ,function (err, results) {
      if (err) { console.log(err) }
      console.log(results);
    }
  );
  // Ends the connection
  connection.end();
}

function createDBConnection() {
  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'strayspotter_database',
    password: process.env.DB_PASSWORD,
  });
  return connection;
}



app.use(express.static(path.join(__dirname, client_folder_name)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, client_folder_name, 'index.html'),); //(__dirname, client_folder_name, 'index.html'),);
});

app.post('/upload', async (req, res) => {

  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    if (!req.file) {
      return res.status(400).send('No file selected!');
    }
    

    // TO be deleted, generating temporary file name
    // const providedFilename = req.file.originalname;
    // let unique_id = create32BitHash(providedFilename);

    // Converting heic to jpg with metadata

    const exifData = await exifr.parse(req.file.buffer);
    console.log(exifData);
    insert_data(exifData).then(picture_id => {
      console.log(picture_id); 

      if (req.file.mimetype == 'image/heic'){
        fileData = convertHeicToJpg(req.file.buffer).then(fileData => { 
            uploadData(fileData, res, 'k' + picture_id)  
        })
      } else { 
        fileData = req.file.buffer
        uploadData(fileData, res, 'k' + picture_id)  
      }
    }).catch(err => {
      console.error("Error inserting data:", err);
    });

  });
});


// List images in the bucket
app.get('/images', async (req, res) => {
    const params = {
      Bucket: bucket_name,
    };
  
    try {
      const command = new ListObjectsV2Command(params);
      const data = await s3Client.send(command);
      
      const imageKeys = (data.Contents || []).map(item => item.Key);
      res.json(imageKeys);
    } catch (err) {
      return res.status(500).send(err.message);
    }
  });

  // Generate a pre-signed URL for accessing an image
  app.get('/image-url', async (req, res) => {

    const { key } = req.query;

    if (!key) {
      return res.status(400).send('Key is required');
    }
  
    const params = {
      Bucket: bucket_name,
      Key: key,
      Expires: 60 * 5, // URL expiration time in seconds
    };
  
    try {
      const url = await getSignedUrl(s3Client, new GetObjectCommand(params));
      res.json({ url });
    } catch (err) {
      return res.status(500).send(err.message);
    }
  });

// Handle the download
app.get('/download', async (req, res) => {
    const { key } = req.query; // Get the file key from query params
  
    const params = {
      Bucket: bucket_name, // Your Wasabi bucket name
      Key: key, // File key to download
    };
  
    try {
      const command = new GetObjectCommand(params);
      const { Body } = await s3Client.send(command);
  
      // Stream the file to the response
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(key)}"`);
      Body.pipe(res);
    } catch (s3Err) {
      return res.status(500).send(s3Err.message);
    }
  });

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});