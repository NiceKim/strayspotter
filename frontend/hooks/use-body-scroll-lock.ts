"use client"

import { useEffect } from "react"

let lockCount = 0

/**
 * Locks document scroll while `locked` is true. Safe when multiple overlays use it (ref-counted).
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return

    lockCount++
    if (lockCount === 1) {
      document.documentElement.style.overflow = "hidden"
      document.body.style.overflow = "hidden"
    }

    return () => {
      lockCount--
      if (lockCount === 0) {
        document.documentElement.style.overflow = ""
        document.body.style.overflow = ""
      }
    }
  }, [locked])
}
