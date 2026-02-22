const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const bucket_name = process.env.NODE_ENV === 'production' ? process.env.PROD_BUCKET : process.env.DEV_BUCKET;
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY_ID
  },
  forcePathStyle: true
});

const GALLERY_PREFIX = 'gallery/';

/**
 * Lists image keys in the gallery, sorted by LastModified descending.
 * @param {number} [maxKeys=100] - Maximum number of keys to return
 * @returns {Promise<string[]>} Array of image keys (without gallery/ prefix)
 */
async function listImageKeys(maxKeys = 100) {
  const command = new ListObjectsV2Command({
    Bucket: bucket_name,
    Prefix: GALLERY_PREFIX
  });
  const data = await s3Client.send(command);
  return (data.Contents || [])
    .filter(item => item.Key?.startsWith(GALLERY_PREFIX) && item.Key !== GALLERY_PREFIX)
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
    .map(item => item.Key.replace(GALLERY_PREFIX, ''))
    .slice(0, maxKeys);
}

/**
 * Generates a presigned URL for accessing an image.
 * @param {string} key - Image key (without gallery/ prefix)
 * @param {number} [expiresIn=3600] - URL expiration in seconds
 * @returns {Promise<string>} Presigned URL
 */
async function getPresignedUrl(key, expiresIn = 60 * 60) {
  const params = {
    Bucket: bucket_name,
    Key: GALLERY_PREFIX + key,
    Expires: expiresIn
  };
  return getSignedUrl(s3Client, new GetObjectCommand(params));
}

/**
 * Uploads a file buffer to S3 gallery.
 * @param {Object} file - { buffer, mimetype, uniquename }
 * @returns {Promise<void>}
 */
async function uploadToCloud(file) {
  const params = {
    Bucket: bucket_name,
    Key: GALLERY_PREFIX + file.uniquename,
    Body: file.buffer,
    ContentType: file.mimetype
  };
  const command = new PutObjectCommand(params);
  await s3Client.send(command);
  console.log(`File uploaded successfully at https://${bucket_name}.s3.amazonaws.com/${params.Key}`);
}

module.exports = {
  listImageKeys,
  getPresignedUrl,
  uploadToCloud
};
