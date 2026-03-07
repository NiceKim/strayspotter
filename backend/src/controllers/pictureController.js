const axios = require('axios');
const db = require('../db');
const { createReport } = require('../services/report');
const { CustomError } = require('../../errors/CustomError');

const SECOND_SERVER_HOST = process.env.SECOND_HOST;
const SECOND_SERVER_PORT = process.env.SECOND_PORT;

/**
 * @typedef {Object} GetReportQuery
 * @property {'daily'|'monthly'} timeFrame - Time frame of the report.
 * @property {string} [statusFilter] - "0" | "1" | "2" (cat status filter).
 * @property {string} [startDate] - YYYY-MM-DD, required when timeFrame is "daily" (start date).
 * @property {string} [endDate] - YYYY-MM-DD, required when timeFrame is "daily" (end date).
 * @property {string} [month] - YYYY-MM, required when timeFrame is "monthly" (target month).
 */

/**
 * @typedef {Object} PictureIdParams
 * @property {string} id - Picture ID.
 */

/**
 * Generates an aggregated report of pictures by day or by month.
 *
 * Request:
 * - Query: {@link GetReportQuery}
 *
 * Response:
 * - 200 OK: Aggregated report data (JSON)
 * - 400 Bad Request: Missing or invalid query parameters
 * - 500 Internal Server Error: Report generation failed
 *
 * @param {GetReportQuery} req.query
 * @returns {Promise<void>}
 */
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

/**
 * Retrieves the current count of pictures for all districts
 * using a district filter value of 0 (meaning "no district filter").
 *
 * Request:
 * - Query: none
 *
 * Response:
 * - 200 OK: JSON containing the current picture count
 * - 500 Internal Server Error: Failed to retrieve the count
 *
 * @returns {Promise<void>}
 */
async function getCurrentCatCount(req, res) {
  try {
    const reportData = await db.getCurrentPictureCount(db.pool);
    res.json(reportData);
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json('Report generation failed');
  }
}

/**
 * Requests an external classification server to determine whether a picture contains a cat.
 *
 * Request:
 * - Params: {@link PictureIdParams}
 *
 * Response:
 * - 200 OK: { isCat: boolean }
 * - On classification server error: { isCat: true } as a fallback
 *
 * @param {PictureIdParams} req.params
 * @returns {Promise<void>}
 */
async function getClassification(req, res) {
  const id = req.params.id;
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Valid picture ID is required' });
  }
  const requestURL = `http://${SECOND_SERVER_HOST}:${SECOND_SERVER_PORT}/classification/${id}`;
  try {
    const response = await axios.get(requestURL);
    res.json({ isCat: response.data });
  } catch (error) {
    console.log('Classification server error:', error);
    res.json({ isCat: true });
  }
}

/**
 * Retrieves GPS coordinates (latitude and longitude) for a picture by its ID.
 *
 * Request:
 * - Params: {@link PictureIdParams}
 *
 * Response:
 * - 200 OK: { latitude: number, longitude: number }
 * - 4xx/5xx: Error status code and message
 *
 * @param {PictureIdParams} req.params
 * @returns {Promise<void>}
 */
async function getGps(req, res) {
  const id = req.params.id;
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Valid picture ID is required' });
  }
  try {
    const picture = await db.fetchPictureById(db.pool, id);
    res.json({ latitude: picture.latitude, longitude: picture.longitude });
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
