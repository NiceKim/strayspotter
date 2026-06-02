const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

jest.mock('../../../src/db', () => ({
  pool: {},
  getCurrentPictureCount: jest.fn(),
  fetchPictureById: jest.fn()
}));

jest.mock('../../../src/services/report', () => ({
  createReport: jest.fn()
}));

jest.mock('axios', () => ({
  get: jest.fn()
}));

const db = require('../../../src/db');
const { createReport } = require('../../../src/services/report');
const axios = require('axios');
const { ValidationError } = require('../../../errors/CustomError');
const { getReport, getCurrentCatCount, getClassification, getGps } = require('../../../src/controllers/pictureController');

describe('pictureController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReport', () => {
    test('missing timeFrame: calls next with ValidationError', async () => {
      const req = { query: {} };
      const next = jest.fn();
      await getReport(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('invalid timeFrame: calls next with ValidationError', async () => {
      const req = { query: { timeFrame: 'weekly' } };
      const next = jest.fn();
      await getReport(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('daily without startDate/endDate: calls next with ValidationError', async () => {
      const req = { query: { timeFrame: 'daily' } };
      const next = jest.fn();
      await getReport(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('monthly without month: calls next with ValidationError', async () => {
      const req = { query: { timeFrame: 'monthly' } };
      const next = jest.fn();
      await getReport(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('invalid statusFilter: calls next with ValidationError', async () => {
      const req = { query: { timeFrame: 'monthly', month: '2025-01', statusFilter: '9' } };
      const next = jest.fn();
      await getReport(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('success daily: calls createReport with correct args and responds with data', async () => {
      const reportData = { records: [], totals: {} };
      createReport.mockResolvedValue(reportData);
      const req = { query: { timeFrame: 'daily', startDate: '2025-01-01', endDate: '2025-01-31' } };
      const res = makeRes();
      const next = jest.fn();

      await getReport(req, res, next);

      expect(createReport).toHaveBeenCalledWith(
        db.pool,
        'daily',
        expect.objectContaining({ startDate: '2025-01-01', endDate: '2025-01-31' })
      );
      expect(res.json).toHaveBeenCalledWith(reportData);
      expect(next).not.toHaveBeenCalled();
    });

    test('success monthly: calls createReport with correct args and responds with data', async () => {
      const reportData = { records: [], totals: {} };
      createReport.mockResolvedValue(reportData);
      const req = { query: { timeFrame: 'monthly', month: '2025-01' } };
      const res = makeRes();
      const next = jest.fn();

      await getReport(req, res, next);

      expect(createReport).toHaveBeenCalledWith(
        db.pool,
        'monthly',
        expect.objectContaining({ month: '2025-01' })
      );
      expect(res.json).toHaveBeenCalledWith(reportData);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentCatCount', () => {
    test('success: calls getCurrentPictureCount and responds with data', async () => {
      const countData = { count: 42 };
      db.getCurrentPictureCount.mockResolvedValue(countData);
      const req = {};
      const res = makeRes();
      const next = jest.fn();

      await getCurrentCatCount(req, res, next);

      expect(db.getCurrentPictureCount).toHaveBeenCalledWith(db.pool);
      expect(res.json).toHaveBeenCalledWith(countData);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getClassification', () => {
    test('missing id: calls next with ValidationError', async () => {
      const req = { params: {} };
      const next = jest.fn();
      await getClassification(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('non-numeric id: calls next with ValidationError', async () => {
      const req = { params: { id: 'abc' } };
      const next = jest.fn();
      await getClassification(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('success: responds with isCat from classification server', async () => {
      axios.get.mockResolvedValue({ data: true });
      const req = { params: { id: '3' } };
      const res = makeRes();
      const next = jest.fn();

      await getClassification(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ isCat: true });
      expect(next).not.toHaveBeenCalled();
    });

    test('classification server error: falls back to isCat: true', async () => {
      axios.get.mockRejectedValue(new Error('server down'));
      const req = { params: { id: '3' } };
      const res = makeRes();
      const next = jest.fn();

      await getClassification(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ isCat: true });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getGps', () => {
    test('missing id: calls next with ValidationError', async () => {
      const req = { params: {} };
      const next = jest.fn();
      await getGps(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('non-numeric id: calls next with ValidationError', async () => {
      const req = { params: { id: 'abc' } };
      const next = jest.fn();
      await getGps(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('success: responds with latitude and longitude', async () => {
      db.fetchPictureById.mockResolvedValue({ latitude: 1.3, longitude: 103.8 });
      const req = { params: { id: '5' } };
      const res = makeRes();
      const next = jest.fn();

      await getGps(req, res, next);

      expect(db.fetchPictureById).toHaveBeenCalledWith(db.pool, '5');
      expect(res.json).toHaveBeenCalledWith({ latitude: 1.3, longitude: 103.8 });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
