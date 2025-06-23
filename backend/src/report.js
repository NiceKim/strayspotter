const { getDailyPictureCount, getMonthlyPictureCount } = require('./db');

/**
 * Creates a picture report (daily or monthly) by fetching and aggregating picture count data.
 *
 * @param {Object} connection The MySQL connection object.
 * @param {"daily" | "monthly"} reportType The type of report to generate.
 * @param {Object} options Options specific to the report type.
 *      For 'daily': { startDate: string, endDate: string, statusFilter?: string }
 *      For 'monthly': { month: string, statusFilter?: string }
* @returns {Promise<Object>} An object containing:
 *   - `records` {Array<Object>}: Array of result rows with:
 *       - `date_taken` | `year_week` {string}
 *       - `district_no` {number}
 *       - `record_count` {number}
 *   - `totals` {Object}:
 *       - `byPeriod` {Object<string, number>}: Total count per period
 *       - `byDistrict` {Object<number, number>}: Total count per district
 *       - `overall` {number}: Grand total
 * @throws {Error} If an invalid reportType is provided
 */
async function createReport(connection, reportType, options) {
  // Validate parameters
  if (reportType === 'daily') {
    if (!options.startDate || !options.endDate) {
      throw new Error('startDate and endDate are required for daily reports');
    }
    if (!validateDateFormat(options.startDate) || !validateDateFormat(options.endDate)) {
      throw new Error('startDate and endDate must be in YYYY-MM-DD format');
    }
  } else if (reportType === 'monthly') {
    if (!options.month) {
      throw new Error('month is required for monthly reports');
    }
    if (!validateMonthFormat(options.month)) {
      throw new Error('month must be in YYYY-MM format');
    }
  } else {
    throw new Error(`Invalid report Type: ${reportType}. Supported types are 'daily', 'monthly'.`);
  }

  let rawData;
  if (reportType === 'daily') {
    rawData = await getDailyPictureCount(connection, options);
  } else if (reportType === 'monthly') {
    rawData = await getMonthlyPictureCount(connection, options);
  }

  const periodTotals = {};
  const districtTotals = {};
  let total = 0;
  for (const row of rawData) {
    const periodKey = row.year_week ?? row.date_taken;
    const { district_no, record_count } = row;
    periodTotals[periodKey] = (periodTotals[periodKey] || 0) + record_count;
    districtTotals[district_no] = (districtTotals[district_no] || 0) + record_count;
    total += record_count;
  }

  return {
    records: rawData,
    totals: {
      byPeriod: periodTotals,
      byDistrict: districtTotals,
      overall: total
    }
  };
}

// Day(YYYY-MM-DD) Check Format
function validateDateFormat(dateStr) {
  // YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// Month(YYYY-MM) Check Format
function validateMonthFormat(monthStr) {
  // YYYY-MM
  return /^\d{4}-\d{2}$/.test(monthStr);
}

module.exports = {
  createReport,
}