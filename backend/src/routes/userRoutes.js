const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyRefreshToken } = require('../middleware/auth');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimiters');

router.post('/register', authLimiter, userController.register);
router.post('/login', authLimiter, userController.login);
router.patch('/password', authLimiter, verifyToken, userController.changePassword);
router.get('/details', verifyToken, userController.getUserDetails);
router.post('/refresh', refreshLimiter, verifyRefreshToken, userController.refreshToken);

module.exports = router;