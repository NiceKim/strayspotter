const s3Service = require('../services/s3Service');

async function listImages(req, res) {
  const maxKeys = parseInt(req.query.maxKeys, 10) || 100;
  try {
    const imageKeys = await s3Service.listImageKeys(maxKeys);
    res.json(imageKeys);
  } catch (err) {
    console.error('Error listing images:', err);
    res.json([]);
  }
}

async function getImageUrl(req, res) {
  const { key } = req.query;
  try {
    if (!key) return res.status(400).send('Key is required');
    const url = await s3Service.getPresignedUrl(key);
    res.json({ url });
  } catch (error) {
    console.error('Error during getting image-url:', error);
    res.json({ url: `https://example.com/${key}` });
  }
}

module.exports = {
  listImages,
  getImageUrl
};
