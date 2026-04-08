const express = require('express');
const router = express.Router();
const multer = require('multer');
const postController = require('../controllers/postController');
const { optionalVerifyToken, verifyToken } = require('../middleware/auth');
const { postLimiter } = require('../middleware/rateLimiters');
const storage = multer.memoryStorage();
const receiveImage = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).single('image');

router.post('/', postLimiter, optionalVerifyToken, receiveImage, postController.uploadImage);
router.delete('/:id', postLimiter, optionalVerifyToken, postController.deletePost);
router.get('/mine', verifyToken, postController.getMyPosts);
router.get('/mine/count', verifyToken, postController.getMyPostsCount);
router.get('/:id/likes', postController.getLikes);
router.post('/:id/likes', verifyToken, postController.likePost);
router.delete('/:id/likes', verifyToken, postController.unlikePost);

module.exports = router;