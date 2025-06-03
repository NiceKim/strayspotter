import Link from "next/link"
import { Button } from "@/components/ui/button"
import StatsSection from "./stats-section"

interface ReportPreviewProps {
  stats: {
    day: number
    week: number
    month: number
  }
  isLoading: boolean
}

export default function ReportPreview({ stats, isLoading }: ReportPreviewProps) {
  return (
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="section-title text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-4">Stray Cat Reports</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Track and analyze stray cat populations to better understand and support our feline neighbors
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-8 md:p-12">
              <h3 className="text-3xl font-semibold text-black mb-16 text-center">Current Statistics</h3>

              <StatsSection stats={stats} isLoading={isLoading} />

              {/* CTA */}
              <div className="text-center">
                <p className="text-gray-600 mb-6">View detailed analytics and insights</p>
                <Link href="/report">
                  <Button className="h-12 rounded-xl bg-primary px-8 text-xl font-bold text-white hover:bg-primary/90 hover:scale-105 transition-all">
                    View Full Report
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}
