// require essentials & modules
require('dotenv').config({ path: '../.env' });
const db = require('../db/index.js');
const s3Service = require('./s3Service.js');
const oneMap = require('../lib/oneMap.js');
const exifr = require('exifr');
const heicConvert = require('heic-convert');
const path = require('path');

/**
 * Handles the full image upload process including metadata extraction, reverse geocoding,
 * database insertion, image format conversion (HEIC to JPG), and cloud upload.
 *
 * @param {Object} connection - MySQL database connection object
 * @param {Object} file - File object containing image data and mimetype
 * @param {number} catStatus - Cat status (0=good, 1=concerned, 2=critical). Must be validated before calling this function.
 *
 * @returns {Promise<number>} The ID of the inserted picture record
 * @throws {Error} Throws if the image format is not accepted or cloud upload fails
 */
async function processImageUpload(connection, file, catStatus) {
  const pictureData = {
    latitude : null,
    longitude : null,
    date : new Date(),
    districtNo : null,
    catStatus : catStatus
  };

  try {
    // Extract metadata from picture
    const exifData = await exifr.parse(file.buffer);
    if (exifData) {
      pictureData.latitude = exifData.latitude;
      pictureData.longitude = exifData.longitude;
      pictureData.date = exifData.DateTimeOriginal;
      const token = await db.getValidToken(connection);
      pictureData.districtNo = await oneMap.reverseGeocode(
        token.access_token,
        pictureData.latitude,
        pictureData.longitude
      );
    }
  } catch (err) {
    console.error("Error getting the metadata:", err);
  }

  const pictureId = await db.insertPictureToDb(connection, pictureData);
 
  try {
    let fileToUpload = {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname
    };

    if (path.extname(file.originalname).toLowerCase() === ".heic") {
      fileToUpload = await convertHeicToJpg(fileToUpload);
    }
    if (fileToUpload.mimetype.startsWith('image/')) {
      fileToUpload.uniquename = 'k' + pictureId + path.extname(file.originalname);
      await s3Service.uploadToCloud(fileToUpload);
    } else {
      throw new Error("Not an accepted Image format");
    }
  } catch (error) {
    console.error("Error during upload process:", error);
    console.log("Deleting picture from DB with ID:", pictureId);
    await db.deletePictureById(connection, pictureId);
    console.log("Deleted picture from DB with ID:", pictureId);
    throw error;
  }
  return pictureId;
}

/**
 * Converts a HEIC image file object to a JPEG image file object.
 *
 * @param {Object} file - File object containing the HEIC image buffer.
 * @param {Buffer} file.buffer - Buffer of the HEIC image to convert.
 * @returns {Promise<Object>} The resulting JPEG file object containing the JPEG buffer and metadata.
 */
async function convertHeicToJpg(file) {
  const jpgBuffer = await heicConvert({
      buffer: file.buffer,
      format: 'JPEG'
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