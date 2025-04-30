"use client"

import { useEffect, useRef, useState } from "react"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import { fetchGalleryImages, fetchImageUrl } from "@/services/api"
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'

type CatMarker = {
  id: string
  latitude: number
  longitude: number
  imageUrl: string
}

export default function MapPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [markers, setMarkers] = useState<CatMarker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const mapRef = useRef(null)

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)

  const loadMarkers = async () => {
    setIsLoading(true)
    try {
      // Fetch image keys from the backend
      const imageKeys = await fetchGalleryImages(20)

      // For each key, fetch the image URL and GPS data
      const markerData = await Promise.all(
        imageKeys.map(async (key) => {
          const imageData = await fetchImageUrl(key)

          // If no GPS data, use random coordinates around Singapore
          const latitude = imageData.latitude || 1.3521 + (Math.random() - 0.5) * 0.05
          const longitude = imageData.longitude || 103.8198 + (Math.random() - 0.5) * 0.05

          return {
            id: key,
            latitude,
            longitude,
            imageUrl: imageData.url,
          }
        }),
      )

      setMarkers(markerData)
    } catch (error) {
      console.error("Error loading map markers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window !== "undefined") {
      setIsMapLoaded(true)
      loadMarkers()
    }
  }, [])

  /*

  // Import Leaflet CSS
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("leaflet/dist/leaflet.css")
    }
  }, [])
   */

  return (
    <div className="min-h-screen bg-[#f5f5dc]">
      <Navbar openUploadModal={openUploadModal} />

      <UploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} onSuccess={loadMarkers} />

      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-center text-4xl font-bold">Cat Pictures on Map - Singapore</h1>

        {isMapLoaded && (
          <div className="mx-auto h-[500px] max-w-[70%] overflow-hidden rounded-lg border-4 border-gray-800">
            <MapContainer
              center={[1.3521, 103.8198]} // Singapore coordinates
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              maxBounds={[
                [1.2, 103.6],
                [1.46, 104.1],
              ]} // Singapore bounds
              minZoom={11}
              maxZoom={30}
              ref={mapRef}
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
                  const L = require("leaflet")
                  const customIcon = new L.Icon({
                    iconUrl: "/resources/icon.png",
                    iconSize: [45, 50],
                  })

                  return (
                    <Marker key={marker.id} position={[marker.latitude, marker.longitude]} icon={customIcon}>
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
        )}
      </div>
    </div>
  )
}

