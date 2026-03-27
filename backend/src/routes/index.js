/**
 * API routes - mounts all sub-routers under /api
 * Each sub-router defines its own paths (e.g. /images, /pictures/*, /posts/*, /users/*)
 * Final paths are exposed under /api.
 */
const express = require('express');
const router = express.Router();

const imageRouter = require('./imageRoutes');
const pictureRouter = require('./pictureRoutes');
const postRouter = require('./postRoutes');
const userRouter = require('./userRoutes');

router.use(imageRouter);
router.use('/pictures', pictureRouter);
router.use('/posts', postRouter);
router.use('/users', userRouter);

module.exports = router;
