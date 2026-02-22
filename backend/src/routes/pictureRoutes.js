const express = require('express');
const router = express.Router();
const pictureController = require('../controllers/pictureController');

router.get('/reports', pictureController.getReport);
router.get('/counts', pictureController.getCurrentCatCount);
router.get('/:id/gps', pictureController.getGps);
router.get('/:id/classification', pictureController.getClassification);

module.exports = router;
