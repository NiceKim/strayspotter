"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import FeaturesSection from "@/components/features/feature-section"
import { fetchGalleryImages, fetchImageUrl, fetchReport, extractStrayCount } from "@/services/api"
import dynamic from "next/dynamic"

const CatMap = dynamic(() => import("@/components/cat-map"), {ssr: false})

export default function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [showSpeechBubble, setShowSpeechBubble] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    month: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const imageKeys = await fetchGalleryImages(4)
        const imageUrls = await Promise.all(
          imageKeys.map(async (key) => {
            const imageData = await fetchImageUrl(key)
            return imageData.url
          }),
        )
        setGalleryImages(imageUrls)

        // Fetch stats
        const dayReport = await fetchReport("day")
        const weekReport = await fetchReport("week")
        const monthReport = await fetchReport("month")

        setStats({
          today: extractStrayCount(dayReport),
          week: extractStrayCount(weekReport),
          month: extractStrayCount(monthReport),
        })
      } catch (error) {
        console.error("Error loading home page data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)

  return (
    <main className="min-h-screen bg-[#f5f5dc]">
      <Navbar openUploadModal={openUploadModal} />

      <UploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />

      {/* Hero Section */}
      <header
        id="home"
        className="flex min-h-screen items-center justify-center px-4 py-16 md:px-8 bg-gradient-to-b from-cat-beige to-white"
      >
        <div className="container flex flex-col items-center justify-between gap-8 md:flex-row">
          <div className="max-w-2xl space-y-8 text-center md:text-left">
            <h1 className="hero-title text-4xl md:text-6xl lg:text-7xl bg-gradient-to-r from-cat-brown to-cat-orange bg-clip-text text-transparent pb-2">
              Share your love for neighborhood cats!
            </h1>
            
            <p className="rounded-3xl bg-cat-brown/40 p-8 text-lg text-white shadow-lg md:text-xl backdrop-blur-sm">
              Spot, share, and support stray cats together. <br/>
              Join a community using photo-sharing to understand and care for neighborhood strays.
            </p>

            <div className="flex justify-center md:justify-start space-x-4">
              <Button
                onClick={openUploadModal}
                className="h-12 rounded-xl bg-primary px-8 text-xl font-bold text-white hover:bg-primary/90 hover:scale-105 transition-all"
              >
                Share Pictures
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl px-8 text-xl font-bold border-cat-brown text-cat-brown hover:text-[#5C4033] hover:bg-cat-brown/20 hover:scale-105 transition-all"
                onClick={() => (window.location.href = "/gallery")}
              >
                View Gallery
              </Button>
            </div>
          </div>

          <div className="relative isolate">
            <div
              className="absolute -inset-10 bg-gradient-to-r from-cat-orange to-primary opacity-35 blur-lg rounded-full"
              style={{ zIndex: -1 }}
            />
            <div
              onMouseEnter={() => setShowSpeechBubble(true)}
              onMouseLeave={() => setShowSpeechBubble(false)}
              style={{ cursor: 'pointer' }}
              className="transition-transform duration-300 hover:rotate-[25deg]"
            >
              <Image
                src="/resources/cathead2.png"
                alt="Interactive Cat"
                width={600}
                height={600}
                className="transition-all duration-300 hover:brightness-110"
              />
            </div>
            {showSpeechBubble && (
              <div className="absolute left-10 top-[-10px] rounded-lg border-2 border-cat-orange bg-white p-3 shadow-lg">
                <p className="text-cat-brown font-medium">Meow! Feed me!</p>
                <div className="absolute bottom-[-8px] left-6 h-0 w-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white"></div>
              </div>
            )}
          </div>
        </div>
      </header>

       {/* Features Section */}
      <FeaturesSection onUploadClick={openUploadModal} />

    

      {/* Gallery Section */}
      <section id="gallery" className="bg-[#506266] py-12 text-center md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="section-title mb-12 text-4xl text-white md:text-5xl lg:text-6xl">Gallery</h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              <div className="col-span-full flex h-64 items-center justify-center">
                <p className="text-xl text-white">Loading gallery images...</p>
              </div>
            ) : galleryImages.length === 0 ? (
              <div className="col-span-full flex h-64 items-center justify-center">
                <p className="text-xl text-white">No images found. Be the first to upload!</p>
              </div>
            ) : (
              galleryImages.map((src, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-3xl shadow-xl transition-all duration-300 hover:scale-105 hover:brightness-110"
                >
                  <Image
                    src={src || "/placeholder.svg"}
                    alt={`Cat ${index + 1}`}
                    width={400}
                    height={400}
                    className="h-full w-full object-cover brightness-100 transition-all duration-300 hover:brightness-100"
                    unoptimized // Use this for external images
                  />
                </div>
              ))
            )}
          </div>

          <Link href="/gallery">
            <Button className="mt-12 rounded-md bg-primary px-8 py-3 text-2xl font-bold text-white hover:bg-primary/90 hover:shadow-lg">
              See More
            </Button>
          </Link>
        </div>
      </section>


      {/* Map Section */}
        <div id="map">
         <CatMap />
      </div>

      {/* Report Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="rounded-lg bg-white p-6 shadow-lg md:p-8">
            <div className="mb-6 text-center">
              <h2 className="section-title mb-2 text-3xl md:text-4xl">Stray Cat Reports</h2>
              <p className="text-gray-600">Stay informed about the stray cat population in your area</p>
            </div>

            <div className="flex flex-col gap-6 md:flex-row md:justify-between">
              <div className="rounded-lg bg-gray-50 p-6 shadow-md">
                <h3 className="mb-4 text-xl font-semibold">Current Statistics</h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-gray-700">Strays Spotted Today:</p>
                    <p className="font-bold text-primary">{isLoading ? "..." : stats.today}</p>
                  </div>

                  <div className="flex justify-between">
                    <p className="text-gray-700">Weekly Total:</p>
                    <p className="font-bold text-primary">{isLoading ? "..." : stats.week}</p>
                  </div>

                  <div className="flex justify-between">
                    <p className="text-gray-700">Monthly Total:</p>
                    <p className="font-bold text-primary">{isLoading ? "..." : stats.month}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <Link href="/report">
                  <Button className="rounded-md bg-primary px-6 py-3 text-lg font-semibold text-white hover:bg-primary/90">
                    View Full Detailed Report
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#34495e] py-6 text-center">
        <p className="text-white transition-all duration-300 hover:text-lg hover:text-primary">
          &copy; Copyright 2024. All Rights Reserved
        </p>
        <p className="text-white transition-all duration-300 hover:text-lg hover:text-primary">
          Follow us on Socials | GitHub
        </p>
      </footer>
    </main>
  )
}

