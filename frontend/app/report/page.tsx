"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import ReportSummary from "@/components/report/report-summary"
import ReportTable from "@/components/report/report-table"
import { fetchDetailedReport, type ReportData } from "@/services/api"
import ReportFiltersComponent, { type ReportFilters } from "@/components/report/report-filters"
import ExportButton from "@/components/report/export-button"


const pad = (n: number) => n.toString().padStart(2, '0');
const getLocalDateString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const getLocalMonthString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export default function ReportPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

 // Initialize filters with default values
 const [filters, setFilters] = useState<ReportFilters>({
  reportType: "monthly",
  selectedMonth: new Date(),
  startDate: null,
  endDate: null,
})
  // 실제로 적용된(데이터와 일치하는) 필터 상태
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(filters)

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)

  const loadReportData = async (nextFilters?: ReportFilters) => {
    const useFilters = nextFilters || filters
    if (useFilters.reportType === "monthly" && !useFilters.selectedMonth) return
    if (useFilters.reportType === "daily" && (!useFilters.startDate || !useFilters.endDate)) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchDetailedReport({
        ...useFilters,
        startDate: useFilters.startDate ? getLocalDateString(useFilters.startDate) : undefined,
        endDate: useFilters.endDate ? getLocalDateString(useFilters.endDate) : undefined,
        month: useFilters.selectedMonth ? getLocalMonthString(useFilters.selectedMonth) : undefined,
      })
      setReportData(data)
      setAppliedFilters(useFilters)
    } catch (err) {
      setError("Failed to load report data. Please try again later.")
      console.error("Error loading report:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (filters.selectedMonth) {
      loadReportData(filters)
    }
  }, []) // Only run on mount

  const handleFiltersChange = (newFilters: ReportFilters) => {
    setFilters(newFilters)
  }

  const handleApplyFilters = () => {
    loadReportData(filters)
  }

  const getReportTitle = () => {
    if (!reportData) return "Report"

    if (appliedFilters.reportType === "monthly" && appliedFilters.selectedMonth) {
      return `Monthly Report - ${appliedFilters.selectedMonth.getFullYear()}-${pad(appliedFilters.selectedMonth.getMonth() + 1)}`
    } else if (appliedFilters.reportType === "daily" && appliedFilters.startDate && appliedFilters.endDate) {
      return `Daily Report - ${getLocalDateString(appliedFilters.startDate)} to ${getLocalDateString(appliedFilters.endDate)}`
    }
    return `${appliedFilters.reportType === "monthly" ? "Monthly" : "Daily"} Report`
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar openUploadModal={openUploadModal} />
      <UploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-cat-brown mb-4">StraySpotter Reports</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Comprehensive analytics and insights about stray cat populations across different districts
          </p>
        </div>

        {/* Report Filters */}
        <ReportFiltersComponent
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onApplyFilters={handleApplyFilters}
          isLoading={isLoading}
        />
        
        {/* Error State */}
        {error && (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Report</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={handleApplyFilters}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </CardContent>
          </Card>
        )}

        {/* Report Content */}
        {!error && reportData && (
          <>
            {/* Summary Cards */}
            <ReportSummary data={reportData} reportType={appliedFilters.reportType} />

            {/* Report Table */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">{getReportTitle()}</h2>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</div>
                  <ExportButton data={reportData} reportType={appliedFilters.reportType} disabled={isLoading} />
                </div>
              </div>

              <ReportTable data={reportData} reportType={appliedFilters.reportType} isLoading={isLoading} />
            </div>

            {/* Additional Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Report Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <strong>Report Type:</strong> {appliedFilters.reportType === "daily" ? "Daily" : "Monthly"} breakdown
                  </div>
                  <div>
                    <strong>Data Source:</strong> Community uploaded photos
                  </div>
                  <div>
                    <strong>Update Frequency:</strong> Real-time
                  </div>
                  <div>
                    <strong>Coverage:</strong> All active districts
                  </div>
                  {appliedFilters.reportType === "monthly" && appliedFilters.selectedMonth && (
                    <div>
                      <strong>Period:</strong>{" "}
                      {appliedFilters.selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </div>
                  )}
                  {appliedFilters.reportType === "daily" && appliedFilters.startDate && appliedFilters.endDate && (
                    <div>
                      <strong>Date Range:</strong> {appliedFilters.startDate.toLocaleDateString()} -{" "}
                      {appliedFilters.endDate.toLocaleDateString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty State - No filters applied */}
        {!error && !reportData && !isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Select Report Parameters</h3>
              <p className="text-gray-500">
                Choose your report type and date parameters above, then click "Apply Filters" to generate your report.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading {appliedFilters.reportType} report data...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}