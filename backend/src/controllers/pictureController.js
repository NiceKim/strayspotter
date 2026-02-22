const axios = require('axios');
const db = require('../db');
const { createReport } = require('../services/report');
const { CustomError } = require('../../errors/CustomError');

const SECOND_SERVER_HOST = process.env.SECOND_HOST;
const SECOND_SERVER_PORT = process.env.SECOND_PORT;

async function getReport(req, res) {
  const pool = db.pool;
  const { timeFrame, statusFilter, startDate, endDate, month } = req.query;

  if (!timeFrame) return res.status(400).send('timeFrame is required');
  if (timeFrame !== 'daily' && timeFrame !== 'monthly') {
    return res.status(400).send('timeFrame must be either "daily" or "monthly"');
  }

  let numericStatusFilter;
  if (statusFilter) {
    numericStatusFilter = parseInt(statusFilter, 10);
    if (isNaN(numericStatusFilter) || numericStatusFilter < 0 || numericStatusFilter > 2) {
      return res.status(400).send('statusFilter must be "0" (good), "1" (concerned), or "2" (critical)');
    }
  }
  if (timeFrame === 'daily' && (!startDate || !endDate)) {
    return res.status(400).send('startDate and endDate are required for daily reports');
  }
  if (timeFrame === 'monthly' && !month) {
    return res.status(400).send('month is required for monthly reports (YYYY-MM format)');
  }

  try {
    let options = { statusFilter: numericStatusFilter };
    if (timeFrame === 'daily') options = { ...options, startDate, endDate };
    else options = { ...options, month };

    const reportData = await createReport(pool, timeFrame, options);
    res.json(reportData);
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json('Report generation failed');
  }
}

async function getCurrentCatCount(req, res) {
  try {
    const reportData = await db.getCurrentPictureCount(db.pool, 0);
    res.json(reportData);
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json('Report generation failed');
  }
}

async function getClassification(req, res) {
  const requestURL = `http://${SECOND_SERVER_HOST}:${SECOND_SERVER_PORT}/classification/${req.params.id}`;
  try {
    const response = await axios.get(requestURL);
    res.json({ isCat: response.data });
  } catch (error) {
    console.log('Classification server error:', error);
    res.json({ isCat: true });
  }
}

async function getGps(req, res) {
  try {
    const { latitude, longitude } = await db.fetchGPSById(db.pool, req.params.id);
    res.json({ latitude, longitude });
  } catch (err) {
    const status = err instanceof CustomError ? err.statusCode : 500;
    res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getReport,
  getCurrentCatCount,
  getClassification,
  getGps
};
