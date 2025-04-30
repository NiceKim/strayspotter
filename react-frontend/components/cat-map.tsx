"use client"

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import dynamic from "next/dynamic"
import { fetchGalleryImages, fetchImageUrl } from "@/services/api"
import type * as Leaflet from "leaflet"
import "leaflet/dist/leaflet.css"

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
)
const Tooltip = dynamic(
  () => import("react-leaflet").then((mod) => mod.Tooltip),
  { ssr: false }
)

type CatMarker = {
  id: string
  latitude: number
  longitude: number
  imageUrl: string
}

type CatMapProps = {
  height?: string | number
  width?: string | number
  maxWidth?: string
  initialZoom?: number
  onMarkerClick?: (markerId: string) => void
  center?: [number, number]
  minZoom?: number
  maxZoom?: number
  maxBounds?: [[number, number], [number, number]]
  iconUrl?: string
  iconSize?: [number, number]
  className?: string
  limit?: number
}

const CatMap = forwardRef<
  { loadMarkers: () => Promise<void> },
  CatMapProps
>(({
  height = "500px",
  width = "100%",
  maxWidth = "70%",
  initialZoom = 11,
  onMarkerClick,
  center = [1.3521, 103.8198], // Default: Singapore
  minZoom = 11,
  maxZoom = 30,
  maxBounds = [[1.2, 103.6], [1.46, 104.1]],
  iconUrl = "/resources/icon.png",
  iconSize = [45, 50],
  className = "mx-auto overflow-hidden rounded-lg border-4 border-gray-800",
  limit = 20
}, ref) => {
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [markers, setMarkers] = useState<CatMarker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const leafletRef = useRef<typeof Leaflet>(null)
  const mapRef = useRef(null)

  useEffect(() => {
    const loadLeaflet = async () => {
      const L = await import("leaflet")
      leafletRef.current = L
      setIsMapLoaded(true)
    }

    if (typeof window !== "undefined") {
      loadLeaflet()
    }
  }, [])

  const loadMarkers = async () => {
    setIsLoading(true)
    try {
      const imageKeys = await fetchGalleryImages(limit)

      const markerData = await Promise.all(
        imageKeys.map(async (key) => {
          const imageData = await fetchImageUrl(key)

          const latitude = imageData.latitude || center[0] + (Math.random() - 0.5) * 0.05
          const longitude = imageData.longitude || center[1] + (Math.random() - 0.5) * 0.05

          return {
            id: key,
            latitude,
            longitude,
            imageUrl: imageData.url,
          }
        })
      )

      setMarkers(markerData)
    } catch (error) {
      console.error("Error loading map markers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isMapLoaded) {
      const timer = setTimeout(() => {
        loadMarkers()
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [isMapLoaded])

  useImperativeHandle(ref, () => ({
    loadMarkers
  }))

  const handleMarkerClick = (markerId: string) => {
    if (onMarkerClick) onMarkerClick(markerId)
  }

  if (!isMapLoaded || !leafletRef.current) {
    return (
      <div style={{ height, width, maxWidth }} className={className + " flex items-center justify-center"}>
        <div>Loading map...</div>
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        height,
        width,
        maxWidth
      }}
    >
      <MapContainer
        center={center}
        zoom={initialZoom}
        style={{ height: "100%", width: "100%" }}
        maxBounds={maxBounds}
        minZoom={minZoom}
        maxZoom={maxZoom}
        ref={mapRef}
        whenReady={() => {
          console.log("Map is ready")
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {isLoading ? (
          <div className="absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 bg-white p-2 text-center">
            Loading markers...
          </div>
        ) : (
          markers.map((marker) => {
            const L = leafletRef.current!
            const customIcon = new L.Icon({
              iconUrl: iconUrl,
              iconSize: iconSize,
              iconAnchor: [iconSize[0] / 2, iconSize[1]],
              popupAnchor: [0, -iconSize[1]]
            })

            return (
              <Marker
                key={marker.id}
                position={[marker.latitude, marker.longitude]}
                icon={customIcon}
                eventHandlers={{
                  click: () => handleMarkerClick(marker.id),
                }}
              >
                <Tooltip permanent={false} sticky={true}>
                  <img
                    src={marker.imageUrl || "/placeholder.svg"}
                    alt="Cat"
                    className="h-auto w-[100px]"
                    crossOrigin="anonymous"
                  />
                </Tooltip>
              </Marker>
            )
          })
        )}
      </MapContainer>
    </div>
  )
})

CatMap.displayName = "CatMap"

export default CatMap
