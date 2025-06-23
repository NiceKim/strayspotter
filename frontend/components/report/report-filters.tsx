"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import DateRangePicker from "./date-range-picker"
import MonthPicker from "./month-picker"
import { RefreshCw } from "lucide-react"

export interface ReportFilters {
  reportType: "daily" | "monthly"
  selectedMonth: Date | null
  startDate: Date | null
  endDate: Date | null
}

interface ReportFiltersProps {
  filters: ReportFilters
  onFiltersChange: (filters: ReportFilters) => void
  onApplyFilters: () => void
  isLoading?: boolean
}

export default function ReportFiltersComponent({
  filters,
  onFiltersChange,
  onApplyFilters,
  isLoading = false,
}: ReportFiltersProps) {
  const handleReportTypeChange = (reportType: "daily" | "monthly") => {
    onFiltersChange({
      ...filters,
      reportType,
      // Clear the other type's filters when switching
      selectedMonth: reportType === "monthly" ? filters.selectedMonth : null,
      startDate: reportType === "daily" ? filters.startDate : null,
      endDate: reportType === "daily" ? filters.endDate : null,
    })
  }

  const handleMonthChange = (selectedMonth: Date | null) => {
    onFiltersChange({
      ...filters,
      selectedMonth,
    })
  }

  const handleDateRangeChange = (startDate: Date | null, endDate: Date | null) => {
    onFiltersChange({
      ...filters,
      startDate,
      endDate,
    })
  }

  const isApplyDisabled = () => {
    if (isLoading) return true

    if (filters.reportType === "monthly") {
      return !filters.selectedMonth
    } else {
      return !filters.startDate || !filters.endDate
    }
  }

  const hasValidFilters = () => {
    if (filters.reportType === "monthly") {
      return !!filters.selectedMonth
    } else {
      return !!filters.startDate && !!filters.endDate
    }
  }

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Report Type Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Report Type</label>
            <div className="flex justify-center">
              <div className="bg-gray-100 rounded-lg p-1 flex">
                <Button
                  onClick={() => handleReportTypeChange("monthly")}
                  disabled={isLoading}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    filters.reportType === "monthly"
                      ? "bg-primary text-white shadow-sm"
                      : "bg-transparent text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Monthly Report
                </Button>
                <Button
                  onClick={() => handleReportTypeChange("daily")}
                  disabled={isLoading}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    filters.reportType === "daily"
                      ? "bg-primary text-white shadow-sm"
                      : "bg-transparent text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Daily Report
                </Button>
              </div>
            </div>
          </div>

          {/* Filter Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filters.reportType === "monthly" ? (
              <div className="md:col-span-2">
                <MonthPicker
                  selectedMonth={filters.selectedMonth}
                  onMonthChange={handleMonthChange}
                  disabled={isLoading}
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <DateRangePicker
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  onDateChange={handleDateRangeChange}
                  maxDays={7}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          {/* Apply Button */}
          <div className="flex justify-center pt-4 border-t">
            <Button
              onClick={onApplyFilters}
              disabled={isApplyDisabled()}
              className="px-8 py-2 bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Apply Filters
                </>
              )}
            </Button>
          </div>

          {/* Filter Summary */}
          {hasValidFilters() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Current filters:</strong>{" "}
                {filters.reportType === "monthly" && filters.selectedMonth && (
                  <>
                    Monthly report for{" "}
                    {filters.selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </>
                )}
                {filters.reportType === "daily" && filters.startDate && filters.endDate && (
                  <>
                    Daily report from {filters.startDate.toLocaleDateString()} to {filters.endDate.toLocaleDateString()}{" "}
                    ({Math.ceil((filters.endDate.getTime() - filters.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1}{" "}
                    days)
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
