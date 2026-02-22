/**
 * API routes - mounts all sub-routers under /api
 * Each sub-router defines its own paths (e.g. /images, /upload)
 * Final paths: /api/images, /api/upload, etc.
 */
const express = require('express');
const router = express.Router();

const imageRouter = require('./imageRoutes');
const pictureRouter = require('./pictureRoutes');
const postRouter = require('./postRoutes');

router.use(imageRouter);
router.use('/pictures', pictureRouter);
router.use('/posts', postRouter);

module.exports = router;
