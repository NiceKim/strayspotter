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
      //console.log(output);
     // var output = await exifr.parse(file, ['GPSLatitude', 'GPSLongitude', 'GPSDateStamp']);
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
   extractMetadata(fileData).then(metadata => {
      console.log(metadata); 
    })

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
    
    console.log(req.file); 

    const providedFilename = req.file.originalname;
    let unique_id = create32BitHash(providedFilename);

    if (req.file.mimetype == 'image/heic'){
      fileData = convertHeicToJpg(req.file.buffer).then(fileData => { 
          uploadData(fileData, res, unique_id)  
      })
    } else { 
      fileData = req.file.buffer
      uploadData(fileData, res, unique_id)  
    }

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