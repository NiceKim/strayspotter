// AWS S3 setup
const { S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');
const bucket_name = process.env.NODE_ENV === 'production' ? "strayspotter-prod-bucket" : "strayspotter-test-bucket";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',  
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY_ID,
  },
  forcePathStyle: true, // Override endpoint resolution for local development
});

/**
 * Uploads a file buffer to an S3 bucket with the specified unique name and MIME type.
 *
 * @param {Object} file - The file object to upload with following properties:
 * - {Buffer} file.buffer - The file data as a buffer.
 * - {string} file.mimetype - The MIME type of the file (e.g., 'image/jpeg').
 * - {string} file.uniquename - The unique name (including extension) used as the S3 key.
 * @returns {Promise<void>} Resolves when the upload is complete
 */
async function uploadToCloud(file) {
    const params = {
      Bucket: bucket_name,
      Key: 'gallery/' + file.uniquename,
      Body: file.buffer,
      ContentType: file.mimetype
    };
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    console.log(`File uploaded successfully at https://${bucket_name}.s3.amazonaws.com/${params.Key}`);
}

module.exports = {
    uploadToCloud
};