"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format, differenceInDays, addDays, subDays } from "date-fns"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  startDate: Date | null
  endDate: Date | null
  onDateChange: (startDate: Date | null, endDate: Date | null) => void
  maxDays?: number
  disabled?: boolean
}

export default function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  maxDays = 7,
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return

    if (!startDate || (startDate && endDate)) {
      // Start new selection
      onDateChange(date, null)
    } else if (startDate && !endDate) {
      // Complete the range
      if (date < startDate) {
        // If selected date is before start date, make it the new start date
        onDateChange(date, startDate)
      } else {
        // Check if range exceeds max days
        const daysDiff = differenceInDays(date, startDate)
        if (daysDiff > maxDays - 1) {
          // Adjust end date to max allowed range
          const adjustedEndDate = addDays(startDate, maxDays - 1)
          onDateChange(startDate, adjustedEndDate)
        } else {
          onDateChange(startDate, date)
        }
      }
      setIsOpen(false)
    }
  }

  const formatDateRange = () => {
    if (!startDate) return "Select date range"
    if (!endDate) return `${format(startDate, "MMM dd, yyyy")} - Select end date`
    return `${format(startDate, "MMM dd, yyyy")} - ${format(endDate, "MMM dd, yyyy")}`
  }

  const getQuickRanges = () => {
    const today = new Date();
    // Monday of a week including today
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
    const thisMonday = subDays(today, dayOfWeek - 1);
    // this week
    const thisWeekStart = thisMonday;
    const thisWeekEnd = addDays(thisMonday, 6);
    // last week
    const lastWeekStart = subDays(thisWeekStart, 7);
    const lastWeekEnd = subDays(thisWeekEnd, 7);
    // two weeks ago
    const prevWeekStart = subDays(thisWeekStart, 14);
    const prevWeekEnd = subDays(thisWeekEnd, 14);
    return [
      {
        label: "This Week",
        start: thisWeekStart,
        end: thisWeekEnd,
      },
      {
        label: "Last Week",
        start: lastWeekStart,
        end: lastWeekEnd,
      },
      {
        label: "2 Weeks Ago",
        start: prevWeekStart,
        end: prevWeekEnd,
      },
    ];
  }

  const handleQuickRange = (start: Date, end: Date) => {
    onDateChange(start, end)
    setIsOpen(false)
  }

  const clearSelection = () => {
    onDateChange(null, null)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Date Range (Max {maxDays} days)</label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            {/* Quick Range Buttons */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Quick ranges:</p>
              <div className="flex flex-wrap gap-2">
                {getQuickRanges().map((range) => (
                  <Button
                    key={range.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickRange(range.start, range.end)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <Calendar
              mode="single"
              selected={startDate || undefined}
              onSelect={handleDateSelect}
              disabled={(date) => date > new Date() || date < subDays(new Date(), 365)}
              initialFocus
            />

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              {startDate && endDate && (
                <div className="text-xs text-gray-500">{differenceInDays(endDate, startDate) + 1} days selected</div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
