import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cat status category types
 */
export type CatCategory = "good" | "concerned" | "critical"
export type CatStatus = 0 | 1 | 2

/**
 * Converts category name to numeric status for API
 * @param category - Category name ("good", "concerned", "critical")
 * @returns Numeric status (0, 1, 2)
 */
export function categoryToStatus(category: CatCategory): CatStatus {
  const mapping: Record<CatCategory, CatStatus> = {
    good: 0,
    concerned: 1,
    critical: 2,
  }
  return mapping[category]
}

/**
 * Converts numeric status to category name
 * @param status - Numeric status (0, 1, 2)
 * @returns Category name ("good", "concerned", "critical")
 */
export function statusToCategory(status: CatStatus): CatCategory {
  const mapping: Record<CatStatus, CatCategory> = {
    0: "good",
    1: "concerned",
    2: "critical",
  }
  return mapping[status]
}
