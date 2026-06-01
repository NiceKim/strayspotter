"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import AuthModal from "@/components/auth-modal"
import FeaturesSection from "@/components/features/feature-section"
import ReportPreview from "@/components/stats/report-preview"
import { fetchGalleryImages, fetchImageUrl, fetchCatCount } from "@/services/api"
import dynamic from "next/dynamic"
import { useDataRefresh } from "@/contexts/DataRefreshContext"
import { Mail, Github } from "lucide-react"

const CatMap = dynamic(() => import("@/components/cat-map"), {ssr: false})

export default function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [showSpeechBubble, setShowSpeechBubble] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [stats, setStats] = useState({
    day: 0,
    week: 0,
    month: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const mapRef = useRef<HTMLElement>(null)
  const { refreshTrigger } = useDataRefresh()

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const posts = await fetchGalleryImages(4)
        const imageUrls = await Promise.all(
          posts.map(async (post) => {
            const imageData = await fetchImageUrl(post.picture_key)
            return imageData.url
          }),
        )
        setGalleryImages(imageUrls)

        // Fetch stats
        const currentCatCount = await fetchCatCount()

        setStats({
          day: currentCatCount.day,
          week: currentCatCount.week,
          month: currentCatCount.month,
        })
      } catch (error) {
        console.error("Error loading home page data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [refreshTrigger])

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)
  const openAuthModal = () => setIsAuthModalOpen(true)
  const closeAuthModal = () => setIsAuthModalOpen(false)

  return (
    <main className="min-h-screen bg-[#f5f5dc]">
      <Navbar openUploadModal={openUploadModal} openAuthModal={openAuthModal} mapRef={mapRef} />

      <UploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} />

      {/* Hero Section */}
      <header
        id="home"
        className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cat-beige via-cat-beige/90 to-white py-16 sm:py-20 md:py-16"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-10 px-5 sm:px-8 md:flex-row md:gap-12 lg:px-10">
          <div className="w-full max-w-2xl space-y-6 text-center sm:space-y-8 md:text-left">
            <h1 className="hero-title bg-gradient-to-r from-cat-brown to-cat-orange bg-clip-text pb-2 text-4xl text-transparent md:text-6xl lg:text-7xl">
              Share your love for neighborhood cats!
            </h1>

            <div className="rounded-3xl bg-cat-brown/40 p-5 shadow-lg backdrop-blur-sm sm:p-7 md:p-8">
              <p className="text-base leading-relaxed text-white sm:text-lg md:text-xl">
                Spot, share, and support stray cats together. <br />
                Join a community using photo-sharing to understand and care for neighborhood strays.
              </p>
            </div>

            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center md:justify-start md:gap-4">
              <Button
                onClick={openUploadModal}
                className="h-12 w-full rounded-xl bg-primary px-8 text-xl font-bold text-white transition-all hover:scale-105 hover:bg-primary/90 sm:w-auto"
              >
                Share Pictures
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full rounded-xl border-cat-brown px-8 text-xl font-bold text-cat-brown transition-all hover:scale-105 hover:bg-cat-brown/20 hover:text-[#5C4033] sm:w-auto"
                onClick={() => (window.location.href = "/gallery")}
              >
                View Gallery
              </Button>
            </div>
          </div>

          <div className="relative isolate">
            <div
              className="absolute -inset-10 bg-gradient-to-r from-cat-orange to-primary opacity-20 blur-lg rounded-full"
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
                width={500}
                height={500}
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
      <section className="py-20 md:py-28 min-h-[800px] bg-cat-beige/50">
        <FeaturesSection onUploadClick={openUploadModal} />
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 md:py-28 min-h-[800px] bg-cat-brown text-center">
        <div className="container mx-auto px-4 h-full flex flex-col">
          <h2 className="section-title mb-[100px] text-4xl text-white md:text-5xl lg:text-6xl">Gallery</h2>   

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-20">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="animate-pulse overflow-hidden rounded-3xl bg-gray-300 h-64" />
              ))
            ) : galleryImages.length === 0 ? (
              <div className="col-span-full flex h-64 items-center justify-center">
                <div className="text-center">
                  <div className="rounded-full bg-cat-orange/20 p-6 mx-auto mb-12 w-fit">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 text-cat-orange"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-xl text-white">No images found. Be the first to upload!</p>
                </div>
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
                    unoptimized
                  />
                </div>
              ))
            )}
          </div>

          <div className="flex justify-center mt-auto mb-8">
            <Link href="/gallery">
              <Button className="h-12 rounded-xl bg-primary px-8 text-xl font-bold text-white hover:bg-primary/90 hover:scale-105 transition-all">
                See More
              </Button>
            </Link>
          </div>
        </div>
      </section>


      {/* Map Section */}
      <section ref={mapRef} id="map" className="bg-cat-beige px-4 py-16 sm:px-6 md:px-8 md:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="section-title mb-4 text-4xl text-cat-brown md:text-5xl lg:text-6xl">Stray Cat Map</h2>
            <p className="mx-auto max-w-3xl text-lg text-gray-600 md:text-xl">
              Explore the locations of spotted stray cats in your neighborhood. Each marker represents a cat sighting, helping us understand their distribution and needs.
            </p>
          </div>
          <div className="relative z-0 isolate overflow-hidden rounded-lg shadow-lg">
            <CatMap />
          </div>
        </div>
      </section>

      {/* Report Section */}
      <section className="py-20 md:py-28 min-h-[800px] bg-[#f0f4ff] px-10">
        <ReportPreview stats={stats} isLoading={isLoading} />
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 py-6 text-center">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <Image
              src="/resources/logo.jpeg"
              alt="StraySpotter logo"
              width={80}
              height={80}
              className="mx-auto rounded-full border-4 border-white/20"
            />
            <h3 className="mt-4 text-2xl font-bold text-white">StraySpotter</h3>
            <p className="text-white/70">Connecting cat lovers, helping strays</p>
          </div>
          <div className="mb-8 flex justify-center space-x-4">
            <a
              href="mailto:96nicekim@gmail.com"
              className="rounded-full bg-white/10 p-3 text-white hover:bg-primary hover:text-white transition-colors"
              aria-label="Email"
            >
              <Mail className="h-6 w-6" />
            </a>
            <a
              href="https://github.com/NiceKim/strayspotter"
              className="rounded-full bg-white/10 p-3 text-white hover:bg-primary hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-6 w-6" />
            </a>
          </div>
          <div className="border-t border-white/10 pt-6">
            <p className="text-white/70">&copy; Copyright 2024. All Rights Reserved</p>
          </div>
        </div>
      </footer>
    </main>
  )
}

