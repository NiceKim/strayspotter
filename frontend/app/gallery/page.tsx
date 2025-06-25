"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import { fetchGalleryImages, fetchImageUrl } from "@/services/api"
import { useDataRefresh } from "@/contexts/DataRefreshContext"

type GalleryItem = {
  id: string
  src: string
}

export default function GalleryPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { refreshTrigger } = useDataRefresh()

  const loadImages = async () => {
    setIsLoading(true)
    try {
      const imageKeys = await fetchGalleryImages(12)
      const items = await Promise.all(
        imageKeys.map(async (key) => {
          const imageData = await fetchImageUrl(key)
          return {
            id: key,
            src: imageData.url,
          }
        }),
      )
      setGalleryItems(items)
    } catch (error) {
      console.error("Error loading gallery images:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [refreshTrigger])

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)

  const loadMoreImages = async () => {
    const currentCount = galleryItems.length
    try {
      const imageKeys = await fetchGalleryImages(currentCount + 6)
      const newKeys = imageKeys.slice(currentCount)

      const newItems = await Promise.all(
        newKeys.map(async (key) => {
          const imageData = await fetchImageUrl(key)
          return {
            id: key,
            src: imageData.url,
          }
        }),
      )

      setGalleryItems([...galleryItems, ...newItems])
    } catch (error) {
      console.error("Error loading more images:", error)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5dc]">
      <Navbar openUploadModal={openUploadModal} />

      <UploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />

      <div id="aesthetic" className="mx-auto my-16 max-w-7xl rounded-4xl bg-[#10403B] px-4 py-2 shadow-2xl">
        <div className="rounded-4xl bg-white p-8">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-xl">Loading gallery images...</p>
            </div>
          ) : galleryItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-xl">No images found. Be the first to upload!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
              {galleryItems.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-3xl shadow-xl h-[500px] flex items-center justify-center bg-gray-100 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                >
                  <div className="relative w-full h-full">
                    <Image
                      src={item.src || "/placeholder.svg"}
                      alt={`Cat ${item.id}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {galleryItems.length > 0 && (
            <div className="mt-8 flex justify-center">
              <Button
                onClick={loadMoreImages}
                className="h-12 rounded-xl bg-primary px-8 text-xl font-bold text-white hover:bg-primary/90 hover:scale-105 transition-all"
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

