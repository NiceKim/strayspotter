"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import { fetchReport, extractStrayCount } from "@/services/api"

export default function ReportPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [activeTimeframe, setActiveTimeframe] = useState<string | null>(null)
  const [strayCount, setStrayCount] = useState(0)
  const [reportText, setReportText] = useState("Select a timeframe to view the report.")
  const [isLoading, setIsLoading] = useState(false)

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)

  const showReport = async (timeframe: "day" | "week" | "month") => {
    setActiveTimeframe(timeframe)
    setIsLoading(true)

    try {
      const reportData = await fetchReport(timeframe)
      setReportText(reportData)
      setStrayCount(extractStrayCount(reportData))
    } catch (error) {
      console.error(`Error fetching ${timeframe} report:`, error)
      setReportText(`Error loading ${timeframe} report. Please try again later.`)
      setStrayCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5dc]">
      <Navbar openUploadModal={openUploadModal} />

      <UploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />

      <Card className="mx-auto my-24 max-w-4xl bg-white p-8 shadow-xl">
        <CardContent className="p-0">
          <h1 className="mb-8 text-center text-5xl font-bold text-gray-700">StraySpotter Report</h1>

          <div className="mb-6 flex justify-center gap-4">
            <Button
              onClick={() => showReport("day")}
              className={`rounded-full px-8 py-4 text-xl font-bold ${activeTimeframe === "day" ? "bg-primary/90" : "bg-primary"}`}
              disabled={isLoading}
            >
              Daily
            </Button>
            <Button
              onClick={() => showReport("week")}
              className={`rounded-full px-8 py-4 text-xl font-bold ${activeTimeframe === "week" ? "bg-primary/90" : "bg-primary"}`}
              disabled={isLoading}
            >
              Weekly
            </Button>
            <Button
              onClick={() => showReport("month")}
              className={`rounded-full px-8 py-4 text-xl font-bold ${activeTimeframe === "month" ? "bg-primary/90" : "bg-primary"}`}
              disabled={isLoading}
            >
              Monthly
            </Button>
          </div>

          <p id="stray-count" className="mb-4 text-center text-2xl">
            There are{" "}
            <strong>
              <em>{strayCount}</em>
            </strong>{" "}
            strays spotted.
          </p>

          <div className="max-h-[400px] overflow-y-auto rounded-lg bg-gray-50 p-8 text-lg leading-relaxed text-[#10403B]">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <p>Loading report data...</p>
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: reportText }} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

