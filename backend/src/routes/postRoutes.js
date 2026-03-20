const express = require('express');
const router = express.Router();
const multer = require('multer');
const postController = require('../controllers/postController');
const { optionalVerifyToken } = require('../middleware/auth');
const { postLimiter } = require('../middleware/rateLimiters');
const storage = multer.memoryStorage();
const receiveImage = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).single('image');

router.post('/', postLimiter, optionalVerifyToken, receiveImage, postController.uploadImage);
router.delete('/:id', postLimiter, optionalVerifyToken, postController.deletePost);

module.exports = router;