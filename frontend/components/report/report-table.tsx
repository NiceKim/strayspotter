import type { ReportData } from "@/services/api"
import {getDistrictRows } from "@/lib/export"

interface ReportTableProps {
  data: ReportData
  reportType: "daily" | "monthly"
  isLoading?: boolean
}

export default function ReportTable({ data, reportType, isLoading = false }: ReportTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report data...</p>
        </div>
      </div>
    )
  }

  if (!data.records || data.records.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <p className="text-gray-600">No data available for this report.</p>
      </div>
    )
  }

  // extract periods, districts 
  const periods = Object.keys(data.totals.byPeriod).sort();
  const districts = Object.keys(data.totals.byDistrict).map(Number).sort((a, b) => a - b);
  // create rows using shared util
  const rows = getDistrictRows(periods, districts, data.records);

  const formatPeriodHeader = (period: string) => {
    if (reportType === "daily") {
      // Format date string to be more readable
      const date = new Date(period)
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }
    return period // Week1, Week2, etc.
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Header */}
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[100px]">District #</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[150px]">District Name</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 min-w-[80px]">Total</th>
              {periods.map((period) => (
                <th key={period} className="px-4 py-3 text-center text-sm font-medium text-gray-700 min-w-[80px]">
                  {formatPeriodHeader(period)}
                </th>
              ))}
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody className="divide-y divide-gray-200">
            {rows.map((row, index) => (
              <tr key={row.districtNumber ?? index}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.districtNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{row.districtName}</td>
                <td className="px-4 py-3 text-sm text-center font-medium text-primary">
                  {data.totals.byDistrict[row.districtNumber] || 0}
                </td>
                {periods.map((period) => (
                  <td key={period} className="px-4 py-3 text-sm text-center text-gray-600">
                    {row.data[period] || 0}
                  </td>
                ))}
              </tr>
            ))}

            {/* Totals Row */}
            <tr className="bg-primary/5 border-t-2 border-primary/20">
              <td className="px-4 py-3 text-sm font-bold text-gray-900" colSpan={2}>
                Totals
              </td>
              <td className="px-4 py-3 text-sm text-center font-bold text-primary">{data.totals.overall}</td>
              {periods.map((period) => (
                <td key={period} className="px-4 py-3 text-sm text-center font-medium text-gray-700">
                  {data.totals.byPeriod[period] || 0}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
