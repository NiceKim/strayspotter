/**
 * API routes - mounts all sub-routers under /api
 * Each sub-router defines its own paths (e.g. /images, /upload)
 * Final paths: /api/images, /api/upload, etc.
 */
const express = require('express');
const router = express.Router();

const galleryRouter = require('./gallery');
const postRouter = require('./post');
const picturesRouter = require('./pictures');

router.use(galleryRouter);
router.use(postRouter);
router.use(picturesRouter);

module.exports = router;
