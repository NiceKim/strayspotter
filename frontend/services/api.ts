/**
 * API service for communicating with the StraySpotter backend
 */

// Base URL for API requests - adjust based on your Docker setup
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

/**
 * Fetches gallery images from the backend
 * @param maxKeys Maximum number of images to fetch
 * @returns Array of image keys
 */
export async function fetchGalleryImages(maxKeys = 100): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/images?maxKeys=${maxKeys}`)
    if (!response.ok) {
      throw new Error("Failed to fetch images")
    }
    return await response.json()
  } catch (error) {
    console.error("Error fetching gallery images:", error)
    return []
  }
}

/**
 * Fetches image URL and metadata by key
 * @param key Image key
 * @returns Object containing image URL and metadata
 */
export async function fetchImageUrl(key: string): Promise<{ url: string; latitude?: number; longitude?: number }> {
  try {
    const response = await fetch(`${API_URL}/image-url?key=${key}`)
    if (!response.ok) {
      throw new Error("Failed to fetch image URL")
    }
    return await response.json()
  } catch (error) {
    console.error("Error fetching image URL:", error)
    return { url: "/placeholder.svg" }
  }
}

/**
 * Report data structure
 */
export interface ReportData {
  records: Array<{
    districtNumber: string
    districtName: string
    data: Record<string, number>
  }>
  totals: {
    byPeriod: Record<string, number>
    byDistrict: Record<string, number>
    overall: number
  }
}

/**
 * Fetches report data based on timeframe
 * @param timeframe 'day', 'week', or 'month'
 * @returns Report data structure or HTML string for legacy support
 */
export async function fetchReport(timeframe: "day" | "week" | "month"): Promise<string | ReportData> {
  try {
    const response = await fetch(`${API_URL}/report?method=${timeframe}`)
    if (!response.ok) {
      throw new Error("Failed to fetch report")
    }

    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as ReportData
    } else {
      // Legacy HTML response
      return await response.text()
    }
  } catch (error) {
    console.error("Error fetching report:", error)
    return "Error loading report data"
  }
}

/**
 * Fetches detailed report data for table display
 * @param params { reportType, startDate, endDate, month, statusFilter }
 * @returns Structured report data
 */
export async function fetchDetailedReport({
  reportType,
  startDate,
  endDate,
  month,
  statusFilter
}: {
  reportType: "daily" | "monthly",
  startDate?: string,
  endDate?: string,
  month?: string,
  statusFilter?: "happy" | "normal" | "sad"
}): Promise<ReportData> {
  const params = new URLSearchParams()
  params.append("timeFrame", reportType)
  if (reportType === "daily") {
    if (startDate) params.append("startDate", startDate)
    if (endDate) params.append("endDate", endDate)
  }
  if (reportType === "monthly" && month) {
    params.append("month", month)
  }
  if (statusFilter) {
    params.append("statusFilter", statusFilter)
  }

  try {
    const response = await fetch(`${API_URL}/report?${params.toString()}`)
    if (!response.ok) {
      throw new Error("Failed to fetch detailed report")
    }
    return await response.json()
  } catch (error) {
    console.error("Error fetching detailed report:", error)
    throw error
  }
}

interface CatCount {
  day: number;
  week: number;
  month: number;
}

export async function fetchCatCount(): Promise<CatCount> {
  try {
    const response = await fetch(`${API_URL}/current-cat-count`)
    if (!response.ok) {
      throw new Error("Failed to fetch cat count")
    }
    return await response.json() as CatCount
  } catch (error) {
    console.error("Error fetching cat count:", error)
    return {
      day: 0,
      week: 0,
      month: 0
    }
  }
}

interface UploadResponse {
  success: boolean;
  message: string;
}

/**
 * Uploads an image to the backend
 * @param formData FormData containing the image and metadata
 * @returns Upload result
 */
export async function uploadImage(formData: FormData): Promise<UploadResponse> {
  try {
    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Failed to upload image")
    }

    const result = await response.text()
    return {
      success: true,
      message: result
    }
  } catch (error) {
    console.error("Error uploading image:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }
  }
}

/**
 * Extracts the number of strays from a report string
 * @param reportText Report text containing numbers
 * @returns Total number of strays
 */
export function extractStrayCount(reportText: string): number {
  // Extract all numbers from the report text
  const numbers = reportText.match(/\d+/g)
  if (!numbers) return 0
  return Number.parseInt(numbers[0], 10)
}

/**
 * Fetches GPS data by ID
 * @param id Numeric ID
 * @returns Object containing latitude and longitude
 */
export async function fetchGPSByID(id: String): Promise<{ latitude?: number; longitude?: number }> {
  try {
    const response = await fetch(`${API_URL}/gps/${id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch GPS data");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching GPS data:", error)
    return { latitude: undefined, longitude: undefined }
  }
}