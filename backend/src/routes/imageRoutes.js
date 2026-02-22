const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

router.get('/images', imageController.listImages);
router.get('/image-url', imageController.getImageUrl);

module.exports = router;
