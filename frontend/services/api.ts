/**
 * API service for communicating with the StraySpotter backend
 */

import type { CatCategory } from "@/lib/utils"
import { categoryToStatus } from "@/lib/utils"

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
export async function fetchImageUrl(key: string): Promise<{ url: string }> {
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
    const response = await fetch(`${API_URL}/pictures/reports?method=${timeframe}`)
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
  statusFilter?: CatCategory
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
    const numericStatus = categoryToStatus(statusFilter)
    params.append("statusFilter", numericStatus.toString())
  }

  try {
    const response = await fetch(`${API_URL}/pictures/reports?${params.toString()}`)
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
    const response = await fetch(`${API_URL}/pictures/counts`)
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
    const response = await fetch(`${API_URL}/posts/upload`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to upload image: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
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
 * Auth response structure from register/login
 */
interface AuthResponse {
  token: string
  user: { userId: number; accountId: string; email: string }
}

/**
 * Registers a new user
 * @param accountId User's account ID
 * @param password User's password
 * @param email User's email
 * @returns Auth response with token and user
 */
export async function register(
  accountId: string,
  password: string,
  email: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, password, email }),
  })

  if (!response.ok) {
    const text = await response.text()
    let message = "Failed to register"
    try {
      const data = text ? JSON.parse(text) : {}
      if (data.message) message = data.message
    } catch {
      if (text) message = text
    }
    throw new Error(message)
  }

  return response.json()
}

/**
 * Logs in an existing user
 * @param accountId User's account ID
 * @param password User's password
 * @returns Auth response with token and user
 */
export async function login(accountId: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, password }),
  })

  if (!response.ok) {
    const text = await response.text()
    let message = "Failed to login"
    try {
      const data = text ? JSON.parse(text) : {}
      if (data.message) message = data.message
    } catch {
      if (text) message = text
    }
    throw new Error(message)
  }

  return response.json()
}

export interface UserDetails {
  accountId: string
  email: string
  joinedDate: string
}

/**
 * Fetches current user details (requires auth token)
 * @param token JWT token
 * @returns User details (accountId, email, joinedDate)
 */
export async function fetchUserDetails(token: string): Promise<UserDetails> {
  const response = await fetch(`${API_URL}/users/details`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    let message = "Failed to fetch user details"
    try {
      const data = text ? JSON.parse(text) : {}
      if (data.message) message = data.message
    } catch {
      if (text) message = text
    }
    throw new Error(message)
  }

  return response.json()
}

/**
 * Fetches GPS data by ID
 * @param id Numeric ID
 * @returns Object containing latitude and longitude
 */
export async function fetchGPSByID(id: String): Promise<{ latitude?: number; longitude?: number }> {
  try {
    const response = await fetch(`${API_URL}/pictures/${id}/gps`);
    if (!response.ok) {
      throw new Error("Failed to fetch GPS data");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching GPS data:", error)
    return { latitude: undefined, longitude: undefined }
  }
}