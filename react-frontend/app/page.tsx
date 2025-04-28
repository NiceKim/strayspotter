"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import { fetchGalleryImages, fetchImageUrl, fetchReport, extractStrayCount } from "@/services/api"

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
        // Fetch gallery preview images
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
      <header id="home" className="flex min-h-screen items-center justify-center px-4 py-16 md:px-8">
        <div className="container flex flex-col items-center justify-between gap-8 md:flex-row">
          <div className="max-w-2xl space-y-6 text-center md:text-left">
            <h1 className="hero-title text-4xl md:text-6xl lg:text-7xl">Share your love for neighborhood cats!</h1>

            <p className="rounded-3xl bg-[#506266]/40 p-6 text-lg text-white shadow-lg md:text-xl">
              Stray Spotter is a platform for cat lovers to share photos of neighborhood cats with fellow enthusiasts!
              By gathering data from these shared images, the platform provides insights into the status of stray cats,
              helping to support them and promote harmony between cats and their communities.
            </p>

            <div className="flex justify-center md:justify-start">
              <Button
                onClick={openUploadModal}
                className="h-12 rounded-xl bg-primary px-8 text-xl font-bold text-white hover:bg-primary/90"
              >
                Share Pictures
              </Button>
            </div>
          </div>

          <div className="relative">
            <div
              onMouseEnter={() => setShowSpeechBubble(true)}
              onMouseLeave={() => setShowSpeechBubble(false)}
              className="transition-transform duration-300 hover:rotate-[25deg]"
            >
              <Image
                src="/resources/cathead2.png"
                alt="Interactive Cat"
                width={400}
                height={400}
                className="transition-all duration-300 hover:brightness-110"
              />
            </div>

            {showSpeechBubble && (
              <div className="absolute left-5 top-[-50px] rounded-lg border-2 border-black bg-white p-3">
                Meow! Feed me!
              </div>
            )}
          </div>
        </div>
      </header>

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
                    className="h-full w-full object-cover brightness-75 transition-all duration-300 hover:brightness-100"
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

      {/* Team Section */}
      <section id="founders" className="bg-[#042940] py-12 text-center md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="section-title mb-12 text-4xl text-white md:text-5xl lg:text-6xl">Our Team</h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: "Min Thiha Khine (Alex)",
                image: "/resources/alex.jpg",
                role: "Frontend Developer",
                bio: "JCU Bachelor of Information Technology",
                skills: [
                  "Client-sided web development",
                  "Developed Frontend through HTML,CSS, JS",
                  "Optimized visuals and user interactions",
                ],
              },
              {
                name: "Jowoon Kim (John)",
                image: "/resources/jowoon.jpg",
                role: "Project Manager & Backend Developer",
                bio: "JCU Master of information technology",
                skills: ["Team management", "Database development", "Data report handling", "Data tracking"],
              },
              {
                name: "Kaung Myat Kyaw (Kelvin)",
                image: "/resources/kelvin.jpg",
                role: "Server & Cloud API Developer",
                bio: "JCU Bachelor of Information Technology",
                skills: [
                  "Node.js & express.js web server",
                  "API & Data handling with both client-side web & database",
                  "Map marking using metadata",
                ],
              },
            ].map((member, index) => (
              <div
                key={index}
                className="rounded-3xl bg-white p-6 text-left shadow-lg transition-all duration-300 hover:translate-y-[-10px] hover:shadow-[0_6px_10em_rgba(131,255,179,0.15)]"
              >
                <div className="flex flex-col items-center md:items-start">
                  <Image
                    src={member.image || "/placeholder.svg"}
                    alt={member.name}
                    width={150}
                    height={150}
                    className="mb-4 rounded-full"
                  />

                  <h3 className="text-2xl font-bold text-gray-800">{member.name}</h3>
                  <p className="text-gray-600">{member.role}</p>
                  <p className="my-2 text-gray-600">{member.bio}</p>

                  <ul className="ml-5 list-disc text-gray-600">
                    {member.skills.map((skill, skillIndex) => (
                      <li key={skillIndex}>{skill}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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

