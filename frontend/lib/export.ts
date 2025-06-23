// Number to Name mapping
export const NumbertoName: Record<number, string> = {
  1: 'Raffles Place, Cecil, Marina, People\'s Park',
  2: 'Anson, Tanjong Pagar',
  3: 'Queenstown, Tiong Bahru',
  4: 'Telok Blangah, Harbourfront',
  5: 'Pasir Panjang, Hong Leong Garden, Clementi New Town',
  6: 'High Street, Beach Road (part)',
  7: 'Middle Road, Golden Mile',
  8: 'Little India',
  9: 'Orchard, Cairnhill, River Valley',
  10: 'Ardmore, Bukit Timah, Holland Road, Tanglin',
  11: 'Watten Estate, Novena, Thomson',
  12: 'Balestier, Toa Payoh, Serangoon',
  13: 'Macpherson, Braddell',
  14: 'Geylang, Eunos',
  15: 'Katong, Joo Chiat, Amber Road',
  16: 'Bedok, Upper East Coast, Eastwood, Kew Drive',
  17: 'Loyang, Changi',
  18: 'Tampines, Pasir Ris',
  19: 'Serangoon Garden, Hougang, Punggol',
  20: 'Bishan, Ang Mo Kio',
  21: 'Upper Bukit Timah, Clementi Park, Ulu Pandan',
  22: 'Jurong',
  23: 'Hillview, Dairy Farm, Bukit Panjang, Choa Chu Kang',
  24: 'Lim Chu Kang, Tengah',
  25: 'Kranji, Woodgrove',
  26: 'Upper Thomson, Springleaf',
  27: 'Yishun, Sembawang',
  28: 'Seletar'  
};

// Making a Rows
export function getDistrictRows(
  periods: string[],
  districts: number[],
  records: any[]
): Array<{ districtNumber: number, districtName: string, data: Record<string, number> }> {
  return districts.map((district_no) => {
    const districtName = NumbertoName[district_no] || `District ${district_no}`;
    const dataByPeriod: Record<string, number> = {};
    periods.forEach((period) => {
      const rec = records.find(
        (r: any) => (r as any).district_no === district_no && ((r as any).date_taken === period || (r as any).year_week === period)
      );
      dataByPeriod[period] = rec ? (rec as any).record_count : 0;
    });
    return {
      districtNumber: district_no,
      districtName,
      data: dataByPeriod,
    };
  });
}

// rows 데이터를 CSV로 export하는 함수
export function exportRowsToCSV(
  rows: Array<{ districtNumber: number, districtName: string, data: Record<string, number> }>,
  periods: string[],
  reportType: string,
  filename?: string
) {
  // 헤더 생성
  const header = ['District #', 'District Name', ...periods, 'Total'];
  // 각 row를 CSV로 변환
  const csvRows = rows.map(row => {
    const periodCounts = periods.map(period => row.data[period] || 0);
    const total = periodCounts.reduce((a, b) => a + b, 0);
    // districtName에 쉼표가 있을 수 있으니 "로 감싼다
    return [row.districtNumber, `"${row.districtName}"`, ...periodCounts, total].join(',');
  });
  // Totals row 생성
  const totalsByPeriod = periods.map(period => rows.reduce((sum, row) => sum + (row.data[period] || 0), 0));
  const totalsRow = ["Totals", "", ...totalsByPeriod, totalsByPeriod.reduce((a, b) => a + b, 0)].join(",");
  // rows 아래에 totalsRow 추가
  const csvContent = [header.join(','), ...csvRows, totalsRow].join('\n');

  // 파일명 생성
  const defaultFilename = `strayspotter-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
  const finalFilename = filename || defaultFilename;

  // 다운로드 트리거
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', finalFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function exportRowsToCSVFromRaw(
  periods: string[],
  districts: number[],
  records: any[],
  reportType: string,
  filename?: string
) {
  const rows = getDistrictRows(periods, districts, records);
  exportRowsToCSV(rows, periods, reportType, filename);
}