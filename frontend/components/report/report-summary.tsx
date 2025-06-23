import type { ReportData } from "@/services/api"

interface ReportSummaryProps {
  data: ReportData
  reportType: "daily" | "monthly"
}

export default function ReportSummary({ data, reportType }: ReportSummaryProps) {
  const periods = Object.keys(data.totals.byPeriod)
  const avgPerPeriod = periods.length > 0 ? Math.round(data.totals.overall / periods.length) : 0
  const districtCount = 28
  const avgPerDistrict = districtCount > 0 ? Math.round(data.totals.overall / districtCount) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
        <div className="text-3xl font-bold text-primary mb-2">{data.totals.overall}</div>
        <div className="text-sm text-gray-600">Total Strays</div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
        <div className="text-3xl font-bold text-cat-brown mb-2">{districtCount}</div>
        <div className="text-sm text-gray-600">Districts</div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
        <div className="text-3xl font-bold text-cat-orange mb-2">{avgPerPeriod}</div>
        <div className="text-sm text-gray-600">Avg per {reportType === "daily" ? "Day" : "Week"}</div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
        <div className="text-3xl font-bold text-green-600 mb-2">{avgPerDistrict}</div>
        <div className="text-sm text-gray-600">Avg per District</div>
      </div>
    </div>
  )
}
