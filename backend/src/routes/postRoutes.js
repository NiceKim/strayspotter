const express = require('express');
const router = express.Router();
const multer = require('multer');
const postController = require('../controllers/postController');

const storage = multer.memoryStorage();
const receiveImage = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).single('image');

router.post('/upload', receiveImage, postController.uploadImage);

module.exports = router;
