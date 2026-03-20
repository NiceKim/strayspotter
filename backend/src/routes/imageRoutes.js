const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const { imageUrlLimiter } = require('../middleware/rateLimiters');

router.get('/images', imageController.listImages);
router.get('/image-url', imageUrlLimiter, imageController.getImageUrl);

module.exports = router;