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
 * Fetches report data based on timeframe
 * @param timeFrame 'day', 'week', or 'month'
 * @returns Report data as HTML string
 */
export async function fetchReport(timeFrame: "day" | "week" | "month"): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/report?timeFrame=${timeFrame}`)
    if (!response.ok) {
      throw new Error("Failed to fetch report")
    }
    return await response.json()
  } catch (error) {
    console.error("Error fetching report:", error)
    return "Error loading report data"
  }
}

/**
 * Uploads an image to the backend
 * @param formData FormData containing the image and metadata
 * @returns Upload result
 */
export async function uploadImage(formData: FormData): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Failed to upload image")
    }

    return await response.text()
  } catch (error) {
    console.error("Error uploading image:", error)
    throw error
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

  // For simplicity, we'll just return the first number found
  // In a real app, you might want to parse the text more carefully
  return Number.parseInt(numbers[0], 10)
}

