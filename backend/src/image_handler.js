// require essentials & modules
require('dotenv').config({ path: '../.env' }) 
const db = require('./db.js');
const helper = require('./helper.js');
const exifr = require('exifr');
const heicConvert = require('heic-convert');
const path = require('path');

/**
 * Handles the full image upload process including metadata extraction, reverse geocoding,
 * database insertion, image format conversion (HEIC to JPG), and cloud upload.
 *
 * @param {Object} connection - MySQL database connection object
 * @param {Object} file - File object containing image data and mimetype
 * @param {string} status - Cat status label (e.g., "happy", "lost")
 * 
 * @returns {Promise<number>} The ID of the inserted picture record
 * @throws {Error} Throws if the image format is not accepted or cloud upload fails
 */
async function processImageUpload(connection, file, status) {
  const pictureData = {
    latitude : null,
    longitude : null,
    date : new Date(),
    postcode : null, 
    districtNo : null,
    districtName : null,
    catStatus : status
  };
  try {
    // Extract metadata from picture
    const exifData = await exifr.parse(file.buffer);
    if (exifData) {
      pictureData.latitude = exifData.latitude;
      pictureData.longitude = exifData.longitude;
      pictureData.date = exifData.DateTimeOriginal;
      //Retrieve Address from GPS
      const address = await db.reverseGeocode(connection, pictureData.latitude, pictureData.longitude);
      pictureData.postcode = address.postcode;
      pictureData.districtName = address.districtName;
      pictureData.districtNo = address.districtNo;
    }
  } catch (err) {
    console.error("Error getting the metadata:", err);
  }
  const pictureID = await db.insertDataToDb(connection, pictureData);
  let fileToUpload = {
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname
  };
  try {
    // Convert HEIC file to JPG for compatibility
    if (path.extname(file.originalname).toLowerCase() === ".heic") {
      fileToUpload = await convertHeicToJpg(fileToUpload);
    }
    if (fileToUpload.mimetype.startsWith('image/')) {
      fileToUpload.uniquename = 'k' + pictureID + path.extname(file.originalname);
      await helper.uploadToCloud(fileToUpload);
    } else {
      throw new Error("Not an accepted Image format");
    }
  } catch (error) {
    db.deleteByID(connection, pictureID);
    throw error;
  }
  return pictureID;
}

/**
 * Converts a HEIC image buffer to a JPEG image buffer.
 *
 * @param {Buffer} inputBuffer The buffer of the HEIC image to convert.
 * @returns {Promise<Buffer>} The resulting JPEG image buffer after conversion.
 */
async function convertHeicToJpg(file) {
  const jpgBuffer = await heicConvert({
      buffer: file.buffer,
      format: 'JPEG',
      quality: 1, // Quality from 0 to 1
  });
  return {
    buffer : jpgBuffer,
    mimetype : 'image/jpeg',
    name : 'file.jpeg'
  };
}


module.exports = {
  processImageUpload
};