// require essentials & modules
require('dotenv').config({ path: '../.env' });
const db = require('../db/index.js');
const s3Service = require('./s3Service.js');
const oneMap = require('../lib/oneMap.js');
const exifr = require('exifr');
const heicConvert = require('heic-convert');
const path = require('path');
const {
  ValidationError,
  PayloadTooLargeError
} = require('../../errors/CustomError');

/**
 * Handles the full image upload process including metadata extraction, reverse geocoding,
 * database insertion, image format conversion (HEIC to JPG), and cloud upload.
 *
 * @param {Object} connection - MySQL database connection object
 * @param {Object} file - File object containing image data and mimetype
 * @param {number} catStatus - Cat status (0=good, 1=concerned, 2=critical). Must be validated before calling this function.
 *
 * @returns {Promise<{pictureKey: string, pictureId: number}>} The key and ID of the inserted picture record
 * @throws {Error} Throws if the image format is not accepted or cloud upload fails
 */
async function processImageUpload(connection, file, catStatus) {
  validateFile(file);
  // Initialize picture data with default values
  const pictureData = {
    latitude : null,
    longitude : null,
    date : new Date(),
    districtNo : null,
    catStatus : catStatus
  };

  try {
    // update picture data with metadata from picture
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
    console.error("Error getting the metadata:", err); // continue with default values
  }

  let fileToUpload = {
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname
  };
  let ext = path.extname(file.originalname || '').toLowerCase();
  const isHeicByExt = ext === '.heic';
  const mt = (file.mimetype || '').toLowerCase();
  const isHeicByMimetype = mt.includes('heic') || mt.includes('heif');
  const isHeicBranch = isHeicByExt || isHeicByMimetype;
  if (isHeicBranch) {
    fileToUpload = await convertHeicToJpg(fileToUpload);
    ext = '.jpg';
  }

  const {pictureKey, pictureId} = await db.insertPictureToDb(connection, pictureData, ext);
 
  try {
    fileToUpload.uniquename = pictureKey;
    await s3Service.uploadToCloud(fileToUpload);
  } catch (error) {
    console.error("Error during upload process:", error);
    throw error;
  }
  return {pictureKey, pictureId};
}

/**
 * Converts a HEIC image file object to a JPEG image file object.
 *
 * @param {Object} file - File object containing the HEIC image buffer.
 * @param {Buffer} file.buffer - Buffer of the HEIC image to convert.
 * @returns {Promise<Object>} The resulting JPEG file object (buffer, mimetype).
 */
async function convertHeicToJpg(file) {
  const jpgBuffer = await heicConvert({
      buffer: file.buffer,
      format: 'JPEG'
  });
  return {
    buffer : jpgBuffer,
    mimetype : 'image/jpeg'
  };
}


function validateFile(file) {
  if (!file) {
    throw new ValidationError("File is required");
  }
  if (!file.buffer) {
    throw new ValidationError("File buffer is required");
  }
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    throw new ValidationError("File mimetype is required and must be an image");
  }
  if (file.buffer.length > 10 * 1024 * 1024) {
    throw new PayloadTooLargeError("File size is too large");
  }
}
module.exports = {
  processImageUpload
};