"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Heart, MessageCircle, Share, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import { fetchGalleryImages, fetchImageUrl } from "@/services/api"

type GalleryItem = {
  id: string
  src: string
  likes: number
  comments: number
}

export default function GalleryPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadImages = async () => {
    setIsLoading(true)
    try {
      // Fetch image keys from the backend
      const imageKeys = await fetchGalleryImages(12)

      // For each key, fetch the image URL
      const items = await Promise.all(
        imageKeys.map(async (key, index) => {
          const imageData = await fetchImageUrl(key)
          return {
            id: key,
            src: imageData.url,
            likes: Math.floor(Math.random() * 200) + 50, // Random likes for demo
            comments: Math.floor(Math.random() * 30) + 5, // Random comments for demo
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
  }, [])

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)

  const loadMoreImages = async () => {
    // In a real app, you would implement pagination
    // For now, we'll just fetch more random images
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
            likes: Math.floor(Math.random() * 200) + 50,
            comments: Math.floor(Math.random() * 30) + 5,
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

      <UploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} onSuccess={loadImages} />

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
                  className="card overflow-hidden rounded-lg bg-white shadow-lg transition-all duration-300 hover:translate-y-[-5px] hover:shadow-xl"
                >
                  <div className="card-content">
                    <Image
                      src={item.src || "/placeholder.svg"}
                      alt={`Cat ${item.id}`}
                      width={400}
                      height={400}
                      className="h-auto w-full"
                      unoptimized // Use this for external images
                    />
                  </div>
                  <div className="card-footer flex justify-between p-4">
                    <div className="action-buttons flex items-center">
                      <button aria-label="Like" className="mr-2 p-1">
                        <Heart className="h-6 w-6" />
                      </button>
                      <span className="mr-4">{item.likes}</span>
                      <button aria-label="Comment" className="mr-2 p-1">
                        <MessageCircle className="h-6 w-6" />
                      </button>
                      <span>{item.comments}</span>
                    </div>
                    <div className="action-buttons flex items-center">
                      <button aria-label="Share" className="p-1">
                        <Share className="h-6 w-6" />
                      </button>
                      <button aria-label="Bookmark" className="ml-2 p-1">
                        <Bookmark className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {galleryItems.length > 0 && (
            <div className="mt-8 flex justify-center">
              <Button
                onClick={loadMoreImages}
                className="rounded-md bg-blue-500 px-6 py-2 font-semibold text-white shadow-md transition-all hover:bg-blue-600 hover:shadow-lg"
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

