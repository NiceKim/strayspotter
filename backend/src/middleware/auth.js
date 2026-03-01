const jwt = require('jsonwebtoken');

/** Verifies access token from Authorization header. Use for protected API routes. */
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
};

/** Verifies refresh token from cookie. Use only for the refresh endpoint. */
const verifyRefreshToken = (req, res, next) => {
    const token = req.cookies?.refreshToken;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
};

module.exports = { verifyToken, verifyRefreshToken };