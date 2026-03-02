const express = require('express');
const router = express.Router();
const multer = require('multer');
const postController = require('../controllers/postController');
const { optionalVerifyToken } = require('../middleware/auth');
const storage = multer.memoryStorage();
const receiveImage = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).single('image');

// POST /api/posts - create a new post with an uploaded image
router.post('/', optionalVerifyToken, receiveImage, postController.uploadImage);

module.exports = router;