const { NumbertoName } = require('./postal_data');
const ExcelJS = require('exceljs');


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
  let rawData;
  if (reportType === 'daily') {
    rawData = await getDailyPictureCount(connection, options);
  } else if (reportType === 'monthly') {
    rawData = await getMonthlyPictureCount(connection, options);
  } else {
    throw new Error(`Invalid report Type: ${reportType}. Supported types are 'daily', 'monthly'.`);
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


/**
 * Create Excel report file from daily report data using exceljs
 * @param {Object} reportData
 * @param {Array} reportData.records - raw data array (Time, District Number, record_count)
 * @param {Object} reportData.totals.byPeriod - { 'YYYY-MM-DD': totalCount } | {'YYYYMM': totalCount } 
 * @param {Object} reportData.totals.byDistrict - { district_no: totalCount }
 * @param {number} reportData.totals.overall - grand total count
 * @param {string} filePath - output xlsx file path
 */
async function createExcelReport(reportData, filePath) {
  const { byPeriod, byDistrict, overall } = reportData.totals;
  const records = reportData.records;
  const periods = Object.keys(byPeriod).sort();
  const districts = Object.keys(byDistrict).map(Number).sort((a, b) => a - b);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Create first Row : Header
  const headerRow = ['No', 'District Name', ...periods, 'Total'];
  worksheet.addRow(headerRow);

  // Create rows by each districts
  for (const district of districts) {
    const row = [district];
    row.push(NumbertoName[district]);
    // columns based on each time period
    for (const period of periods) {
      const rec = records.find(
        r => r.district_no === district && (r.date_taken === period || r.year_week === period)
      );
      row.push(rec ? rec.record_count : 0);
    }
    // district total column
    row.push(byDistrict[district] || 0);
    worksheet.addRow(row);
  }

  // Create Last Row: Totals
  const totalRow = ['Total', '', ...periods.map(p => byPeriod[p] || 0), overall];
  worksheet.addRow(totalRow);

  // Styles
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(worksheet.rowCount).font = { bold: true };
  worksheet.columns.forEach((column, index) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, cell => {
      const value = cell.value ? cell.value.toString() : '';
      if (value.length > maxLength) maxLength = value.length;
      cell.alignment = {
      vertical: 'middle',
      horizontal: index === 1 ? 'left' : 'center'
    };
    });
    column.width = maxLength;
  });

  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Excel report saved to ${filePath}`);
}
