/**
 * API service for communicating with the StraySpotter backend
 */

import type { CatCategory } from "@/lib/utils"
import { categoryToStatus } from "@/lib/utils"

// Base URL for API requests - adjust based on your Docker setup
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

/** Auth callbacks for 401 handling - set by AuthProvider */
export interface AuthCallbacks {
  getToken: () => string | null
  refreshToken: () => Promise<string | null>
  logout: () => void
}

let authCallbacks: AuthCallbacks | null = null

export function setAuthCallbacks(callbacks: AuthCallbacks | null) {
  authCallbacks = callbacks
}

/**
 * Parses API error responses safely.
 * - Prefers JSON { message }
 * - Falls back to plain text
 * - Strips noisy HTML error pages into a clean message
 */
async function parseApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const rawText = await response.text()
  if (!rawText) return fallbackMessage

  try {
    const data = JSON.parse(rawText) as { message?: string }
    if (data?.message) return data.message
  } catch {
    // Not JSON; continue parsing text/HTML.
  }

  // If server returned an HTML error page, extract useful text only.
  if (rawText.includes("<!DOCTYPE html") || rawText.includes("<html")) {
    const unauthorizedMatch = rawText.match(/UnauthorizedError:\s*([^<\n]+)/i)
    if (unauthorizedMatch?.[1]) return unauthorizedMatch[1].trim()

    const preMatch = rawText.match(/<pre>([\s\S]*?)<\/pre>/i)
    if (preMatch?.[1]) {
      const cleaned = preMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/&nbsp;/gi, " ")
        .replace(/<[^>]+>/g, "")
        .trim()
      if (cleaned) return cleaned.split("\n")[0].trim()
    }

    return fallbackMessage
  }

  return rawText.trim() || fallbackMessage
}

/** Decodes JWT payload (no verification - server validates). Returns exp in seconds or null. */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.exp ?? null
  } catch {
    return null
  }
}

/** Returns true if token is expired (with 60s buffer). */
export function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiry(token)
  if (!exp) return true
  return exp * 1000 < Date.now() + 60_000
}

/**
 * Fetch with auth: adds Bearer token, on 401 tries refresh and retries once.
 * Only use for requests without FormData body (body is consumed on first request).
 */
export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const token = authCallbacks?.getToken() ?? null
  const headers = new Headers(init.headers)
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  let response = await fetch(url, { ...init, headers })

  if (response.status === 401 && authCallbacks) {
    const newToken = await authCallbacks.refreshToken()
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`)
      response = await fetch(url, { ...init, headers })
    } else {
      authCallbacks.logout()
      const err = new Error("Session expired") as Error & { status?: number }
      err.status = 401
      throw err
    }
  }

  return response
}

/**
 * Post row returned by the gallery/images API (DB-based).
 */
export interface GalleryPost {
  id: number
  picture_id: number
  picture_key: string
  cat_status: 0 | 1 | 2
  user_id: number | null
  account_id: string | null
  created_at: string
}

export interface LikeActionResponse {
  changed: boolean
  message: string
}

/**
 * Fetches gallery posts from the backend (DB-based).
 * @param maxKeys Maximum number of posts to fetch
 * @param offset Number of posts to skip (for pagination)
 * @returns Array of post objects (id, picture_id, picture_key, cat_status, user_id, account_id, created_at)
 */
export async function fetchGalleryImages(
  maxKeys = 100,
  offset = 0
): Promise<GalleryPost[]> {
  try {
    const response = await fetch(
      `${API_URL}/images?maxKeys=${maxKeys}&offset=${offset}`
    )
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
 * Fetches presigned image URL by object key.
 * @param key S3 object key (e.g. {picture_key}.jpg)
 * @returns Object containing image URL
 */
export async function fetchImageUrl(key: string): Promise<{ url: string }> {
  try {
    const response = await fetch(`${API_URL}/image-url?key=${encodeURIComponent(key)}`)
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
 * @param token Optional JWT token for authenticated uploads
 * @returns Upload result
 */
export async function uploadImage(formData: FormData, token?: string | null): Promise<UploadResponse> {
  const headers: HeadersInit = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(`${API_URL}/posts`, {
    method: "POST",
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    const err = new Error(`Failed to upload image: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`) as Error & { status?: number }
    err.status = response.status
    throw err
  }

  const result = await response.text()
  return {
    success: true,
    message: result
  }
}

/**
 * Deletes a post. For anonymous posts (user_id null), anonymousPassword is required.
 * For posts owned by the current user, uses auth token.
 * @param postId Post ID to delete
 * @param anonymousPassword Required when deleting an anonymous post
 */
export async function deletePost(
  postId: number,
  anonymousPassword?: string
): Promise<void> {
  const url = `${API_URL}/posts/${postId}`
  const init: RequestInit = {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      anonymousPassword != null ? { anonymousPassword } : {}
    ),
  }
  const response = authCallbacks?.getToken()
    ? await fetchWithAuth(url, init)
    : await fetch(url, init)

  if (!response.ok) {
    const text = await response.text()
    let message = "Failed to delete post"
    try {
      const data = text ? JSON.parse(text) : {}
      if (data.message) message = data.message
    } catch {
      if (text) message = text
    }
    const err = new Error(message) as Error & { status?: number }
    err.status = response.status
    throw err
  }
}

/**
 * Fetches the like count for a post.
 * @param postId Post ID
 * @returns Total like count
 */
export async function fetchPostLikes(postId: number): Promise<number> {
  const response = await fetch(`${API_URL}/posts/${postId}/likes`)
  if (!response.ok) {
    const message = await parseApiErrorMessage(response, "Failed to fetch likes")
    const err = new Error(message) as Error & { status?: number }
    err.status = response.status
    throw err
  }
  return response.json()
}

/**
 * Likes a post as the current authenticated user.
 * @param postId Post ID
 * @returns API response with changed flag
 */
export async function likePost(postId: number): Promise<LikeActionResponse> {
  const response = await fetchWithAuth(`${API_URL}/posts/${postId}/likes`, {
    method: "POST",
  })
  if (!response.ok) {
    const message = await parseApiErrorMessage(response, "Failed to like post")
    const err = new Error(message) as Error & { status?: number }
    err.status = response.status
    throw err
  }
  return response.json()
}

/**
 * Unlikes a post as the current authenticated user.
 * @param postId Post ID
 * @returns API response with changed flag
 */
export async function unlikePost(postId: number): Promise<LikeActionResponse> {
  const response = await fetchWithAuth(`${API_URL}/posts/${postId}/likes`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const message = await parseApiErrorMessage(response, "Failed to unlike post")
    const err = new Error(message) as Error & { status?: number }
    err.status = response.status
    throw err
  }
  return response.json()
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
    const message = await parseApiErrorMessage(response, "Failed to register")
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
    const message = await parseApiErrorMessage(response, "Failed to login")
    throw new Error(message)
  }

  return response.json()
}

/**
 * Exchanges refresh token (cookie) for a new access token.
 * @returns New access token
 */
export async function refresh(): Promise<string> {
  const response = await fetch(`${API_URL}/users/refresh`, {
    method: "POST",
  })

  if (!response.ok) {
    const message = await parseApiErrorMessage(response, "Failed to refresh token")
    const err = new Error(message) as Error & { status?: number }
    err.status = response.status
    throw err
  }

  const data = await response.json()
  return data.token
}

export interface UserDetails {
  accountId: string
  email: string
  joinedDate: string
}

/**
 * Fetches current user details (requires auth). Uses fetchWithAuth for 401 auto-refresh.
 * @returns User details (accountId, email, joinedDate)
 */
export async function fetchUserDetails(): Promise<UserDetails> {
  const response = await fetchWithAuth(`${API_URL}/users/details`)

  if (!response.ok) {
    if (response.status === 404) {
      // Token is valid but user no longer exists (e.g. DB reset). Clear local auth to avoid "logged-in but broken" UI.
      authCallbacks?.logout()
    }
    const message = await parseApiErrorMessage(response, "Failed to fetch user details")
    const err = new Error(message) as Error & { status?: number }
    err.status = response.status
    throw err
  }

  return response.json()
}

/**
 * Fetches GPS data by ID
 * @param id Numeric ID
 * @returns Object containing latitude and longitude
 */
export async function fetchGPSByID(id: string | number): Promise<{ latitude?: number; longitude?: number }> {
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