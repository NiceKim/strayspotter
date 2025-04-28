"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

export default function Navbar({ openUploadModal }: { openUploadModal?: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between bg-gray-800 px-5 py-2">
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <Image src="/resources/logo.jpeg" alt="StraySpotter logo" width={60} height={60} className="rounded-full" />
          <span className="nav-logo-text ml-2 text-white">StraySpotter</span>
        </Link>
      </div>

      <button className="flex flex-col space-y-1.5 md:hidden" onClick={toggleMenu} aria-label="Toggle menu">
        {isMenuOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
      </button>

      <ul
        className={`absolute left-0 right-0 top-[4.5rem] flex-col bg-gray-800 py-2 md:static md:flex md:flex-row md:space-x-8 md:py-0 ${isMenuOpen ? "flex" : "hidden md:flex"}`}
      >
        <li className={`px-5 py-2 md:py-0 ${isActive("/") ? "bg-primary rounded-md" : ""}`}>
          <Link
            href="/"
            className="nav-link text-white hover:bg-white hover:bg-opacity-10 hover:text-primary md:px-4 md:py-2 md:rounded-md"
          >
            Home
          </Link>
        </li>
        <li className={`px-5 py-2 md:py-0 ${isActive("/gallery") ? "bg-primary rounded-md" : ""}`}>
          <Link
            href="/gallery"
            className="nav-link text-white hover:bg-white hover:bg-opacity-10 hover:text-primary md:px-4 md:py-2 md:rounded-md"
          >
            Gallery
          </Link>
        </li>
        <li className={`px-5 py-2 md:py-0 ${pathname === "/#founders" ? "bg-primary rounded-md" : ""}`}>
          <Link
            href="/#founders"
            className="nav-link text-white hover:bg-white hover:bg-opacity-10 hover:text-primary md:px-4 md:py-2 md:rounded-md"
          >
            Team
          </Link>
        </li>
        <li className={`px-5 py-2 md:py-0 ${isActive("/map") ? "bg-primary rounded-md" : ""}`}>
          <Link
            href="/map"
            className="nav-link text-white hover:bg-white hover:bg-opacity-10 hover:text-primary md:px-4 md:py-2 md:rounded-md"
          >
            Map
          </Link>
        </li>
        <li className={`px-5 py-2 md:py-0 ${isActive("/report") ? "bg-primary rounded-md" : ""}`}>
          <Link
            href="/report"
            className="nav-link text-white hover:bg-white hover:bg-opacity-10 hover:text-primary md:px-4 md:py-2 md:rounded-md"
          >
            Report
          </Link>
        </li>
      </ul>

      <div className="hidden md:block">
        <button
          onClick={openUploadModal}
          className="transition-transform duration-300 hover:rotate-12"
          aria-label="Upload"
        >
          <Image src="/resources/camera_icon.png" alt="Upload" width={50} height={50} />
        </button>
      </div>
    </nav>
  )
}

