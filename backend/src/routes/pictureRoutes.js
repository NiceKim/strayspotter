const express = require('express');
const router = express.Router();
const pictureController = require('../controllers/pictureController');

router.get('/report', pictureController.getReport);
router.get('/current-cat-count', pictureController.getCurrentCatCount);
router.get('/classification/:id', pictureController.getClassification);
router.get('/gps/:id', pictureController.getGps);

module.exports = router;
