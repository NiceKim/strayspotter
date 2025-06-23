"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth } from "date-fns"
import { cn } from "@/lib/utils"

interface MonthPickerProps {
  selectedMonth: Date | null
  onMonthChange: (month: Date | null) => void
  disabled?: boolean
}

export default function MonthPicker({ selectedMonth, onMonthChange, disabled = false }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(selectedMonth || new Date())

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const currentYear = viewDate.getFullYear()
  const currentMonth = viewDate.getMonth()

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentYear, monthIndex, 1)
    onMonthChange(newDate)
    setIsOpen(false)
  }

  const handleYearChange = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setViewDate(subMonths(viewDate, 12))
    } else {
      setViewDate(addMonths(viewDate, 12))
    }
  }

  const formatSelectedMonth = () => {
    if (!selectedMonth) return "Select month"
    return format(selectedMonth, "MMMM yyyy")
  }

  const isMonthDisabled = (monthIndex: number) => {
    const monthDate = new Date(currentYear, monthIndex, 1)
    const now = new Date()
    return monthDate > now
  }

  const getQuickMonths = () => {
    const now = new Date()
    return [
      {
        label: "This month",
        date: startOfMonth(now),
      },
      {
        label: "Last month",
        date: startOfMonth(subMonths(now, 1)),
      },
      {
        label: "2 months ago",
        date: startOfMonth(subMonths(now, 2)),
      },
    ]
  }

  const handleQuickMonth = (date: Date) => {
    onMonthChange(date)
    setIsOpen(false)
  }

  const clearSelection = () => {
    onMonthChange(null)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Month</label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-start text-left font-normal", !selectedMonth && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatSelectedMonth()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4 space-y-4">
            {/* Quick Month Buttons */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Quick selection:</p>
              <div className="flex flex-wrap gap-2">
                {getQuickMonths().map((month) => (
                  <Button key={month.label} variant="outline" size="sm" onClick={() => handleQuickMonth(month.date)}>
                    {month.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Year Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleYearChange("prev")}
                disabled={currentYear <= 2020}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-lg font-semibold">{currentYear}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleYearChange("next")}
                disabled={currentYear >= new Date().getFullYear()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((month, index) => (
                <Button
                  key={month}
                  variant={
                    selectedMonth && selectedMonth.getMonth() === index && selectedMonth.getFullYear() === currentYear
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => handleMonthSelect(index)}
                  disabled={isMonthDisabled(index)}
                  className="h-10"
                >
                  {month.slice(0, 3)}
                </Button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              {selectedMonth && (
                <div className="text-xs text-gray-500 flex items-center">{format(selectedMonth, "MMMM yyyy")}</div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
