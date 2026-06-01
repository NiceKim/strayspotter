const rateLimit = require('express-rate-limit');

// Central place to manage per-endpoint rate limits.
// Assumes `app.set('trust proxy', 1)` is enabled in `backend/src/server.js`
// so `req.ip` represents the real client IP.

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function makeLimiter({ max, message }) {
  return rateLimit({
    windowMs: WINDOW_MS,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

const generalLimiter = makeLimiter({
  max: 100,
  message: 'Too many requests, please try again later.',
});


const authLimiter = makeLimiter({
  max: 20,
  message: 'Too many authentication requests, please try again later.',
});

const refreshLimiter = makeLimiter({
  max: 10,
  message: 'Too many refresh token requests, please try again later.',
});


const postLimiter = makeLimiter({
  max: 50,
  message: 'Too many write requests, please try again later.',
});


const imageUrlLimiter = makeLimiter({
  max: 50,
  message: 'Too many image URL requests, please try again later.',
});

module.exports = {
  authLimiter,
  postLimiter,
  imageUrlLimiter,
  generalLimiter,
  refreshLimiter,
};

