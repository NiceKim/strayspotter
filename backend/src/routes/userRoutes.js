const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyRefreshToken } = require('../middleware/auth');

router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/details', verifyToken, userController.getUserDetails);
router.post('/refresh', verifyRefreshToken, userController.refreshToken);

module.exports = router;