"use client"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState } from "react"
import { fetchImageUrl, fetchGalleryImages, fetchGPSByID } from "@/services/api"
import { useDataRefresh } from '@/contexts/DataRefreshContext'

/** Default map center (island-wide framing) */
const COORDINATES: [number, number] = [1.3521, 103.8198]
/**
 * Mobile: center slightly toward the urban core (south-central) so the city
 * sits more in the middle of the viewport when zoomed in.
 */
const MOBILE_COORDINATES: [number, number] = [1.304, 103.835]
/** Desktop / tablet initial zoom */
const DEFAULT_ZOOM_LEVEL = 11
/** Narrow viewports: start more zoomed in (matches Tailwind `md` breakpoint) */
const MOBILE_INITIAL_ZOOM_LEVEL = 13
const MIN_ZOOM_LEVEL = 11
const MAX_ZOOM_LEVEL = 30
const SOUTH_WEST_CORNER: [number, number] = [1.2, 103.6]
const NORTH_EAST_CORNER: [number, number] = [1.46, 104.1]
const MARK_ICON_LOCATION = "/resources/icon.png"

function getInitialZoomLevel(): number {
  if (typeof window === "undefined") {
    return DEFAULT_ZOOM_LEVEL
  }
  return window.matchMedia("(max-width: 767px)").matches
    ? MOBILE_INITIAL_ZOOM_LEVEL
    : DEFAULT_ZOOM_LEVEL
}

function getInitialCenter(): [number, number] {
  if (typeof window === "undefined") {
    return COORDINATES
  }
  return window.matchMedia("(max-width: 767px)").matches ? MOBILE_COORDINATES : COORDINATES
}

export default function CatMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [currentTooltip, setCurrentTooltip] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { refreshTrigger } = useDataRefresh()

  useEffect(() => {
    const initializeMap = async () => {
      try {
        // Dynamically import Leaflet
        const L = await import("leaflet")
        // Initialize the map
        const map = L.map(mapRef.current!).setView(getInitialCenter(), getInitialZoomLevel())
        mapInstanceRef.current = map

        // Add OpenStreetMap tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: MAX_ZOOM_LEVEL,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        // Set the bounds for Singapore
        const bounds: any = [SOUTH_WEST_CORNER, NORTH_EAST_CORNER]
        map.setMaxBounds(bounds)
        map.on("drag", () => {
          map.panInsideBounds(bounds)
        })

        // Restrict zoom levels
        map.setMaxZoom(MAX_ZOOM_LEVEL)
        map.setMinZoom(MIN_ZOOM_LEVEL)

        // Load images
        await loadImages(map, L)
        setIsLoading(false)
      } catch (error) {
        console.error("Failed to initialize map:", error)
        setIsLoading(false)
      }
    }

    const raf = requestAnimationFrame(() => {
      if (mapRef.current && !mapInstanceRef.current) {
        initializeMap()
      } else {
        console.error("mapRef not ready")
      }
    })

    // Cleanup function
    return () => {
      cancelAnimationFrame(raf)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [refreshTrigger])

  const loadImages = async (map: any, L: any) => {
    const posts = await fetchGalleryImages(10)
    if (!posts.length) {
      return
    }
    for (const post of posts) {
      try {
        const data = await fetchImageUrl(post.picture_key)
        const gpsData = await fetchGPSByID(post.picture_id)
        const latitude = gpsData.latitude
        const longitude = gpsData.longitude
        if (!latitude || !longitude) { continue }

        const customIcon = L.icon({
          iconUrl: MARK_ICON_LOCATION,
          iconSize: [45, 50],
        })
        const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map)
        const tooltipContent = `<img src="${data.url}" alt="Cat" class="tooltip-image" style="max-width: 200px; max-height: 150px; object-fit: cover;"/>`
        marker.bindTooltip(tooltipContent, { permanent: false, sticky: true })
        marker.on("mouseover", () => {
          if (currentTooltip) {
            currentTooltip.closeTooltip()
          }
          marker.openTooltip()
          setCurrentTooltip(marker)
        })
        marker.on("mouseout", () => {
          marker.closeTooltip()
          setCurrentTooltip(null)
        })
      } catch (error) {
        console.error("Failed to process image for picture:", post.picture_id, error)
      }
    }
  }

  return (
    <div className="relative isolate z-0 w-full">
      <div ref={mapRef} className="h-[600px] w-full rounded-lg border-4 border-black" />
      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gray-200 rounded-lg border-4 border-black flex items-center justify-center z-10">
          <div className="text-gray-600">Loading map...</div>
        </div>
      )}
    </div>
  )
}