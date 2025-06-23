"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download, FileText, Database } from "lucide-react"
import { exportRowsToCSVFromRaw } from "@/lib/export"
import type { ReportData } from "@/services/api"
import { useToast } from "@/hooks/use-toast"

interface ExportButtonProps {
  data: ReportData | null
  reportType: "daily" | "monthly"
  disabled?: boolean
}

export default function ExportButton({ data, reportType, disabled = false }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    if (!data) {
      toast({
        title: "Export Error",
        description: "No data available to export",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    try {
      // Extract periods, districts, and records from the data
      const periods = Object.keys(data.totals.byPeriod).sort();
      const districts = Object.keys(data.totals.byDistrict).map(Number).sort((a, b) => a - b);
      const records = data.records;
      exportRowsToCSVFromRaw(periods, districts, records, reportType);
      toast({
        title: "Export Successful",
        description: "Report exported as CSV file",
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export Failed",
        description: "Failed to export report. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isExporting || !data} className="flex items-center gap-2">
          {isExporting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExport} className="flex items-center gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}