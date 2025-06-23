"use client"

import {useState} from "react"
import Link from "next/link"
import Image from "next/image"
import {usePathname, useRouter} from "next/navigation"
import {Menu, X} from "lucide-react"

interface NavbarProps {
    openUploadModal?: () => void;
    mapRef?: React.RefObject<HTMLElement | null>;
}

export default function Navbar({openUploadModal, mapRef}: NavbarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen)
    }

    const isActive = (path: string) => {
        return pathname === path
    }

    const handleMapClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (pathname !== '/') {
            router.push('/#map');
        } else if (mapRef?.current) {
            const windowHeight = window.innerHeight;
            const sixthScreen = windowHeight / 6;
            const elementPosition = mapRef.current.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - sixthScreen;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }

    return (
        <nav className="sticky top-0 z-50 flex items-center justify-between bg-gray-800 px-5 py-2">
            <div className="flex items-center">
                <Link href="/" className="flex items-center">
                    <Image src="/resources/logo.jpeg" alt="StraySpotter logo" width={60} height={60}
                           className="rounded-full"/>
                    <span className="nav-logo-text ml-2 text-white">StraySpotter</span>
                </Link>
            </div>

            <button className="flex flex-col space-y-1.5 md:hidden" onClick={toggleMenu} aria-label="Toggle menu">
                {isMenuOpen ? <X className="h-6 w-6 text-white"/> : <Menu className="h-6 w-6 text-white"/>}
            </button>

            <ul
                className={`absolute left-0 right-0 top-[4.5rem] flex-col bg-gray-800 py-2 md:static md:flex md:flex-row md:space-x-8 md:py-0 ${isMenuOpen ? "flex" : "hidden md:flex"}`}
            >
                <li className="px-5 py-2 md:p-0">
                    <Link
                        href="/"
                        className={`nav-link rounded-md md:px-4 md:py-2 text-white ${
                            isActive("/")
                                ? "bg-primary"
                                : "hover:bg-white hover:bg-opacity-10 hover:text-primary"
                        }`}
                    >
                        Home
                    </Link>
                </li>
                <li className="px-5 py-2 md:p-0">
                    <Link
                        href="/gallery"
                        className={`nav-link rounded-md md:px-4 md:py-2 text-white ${
                            isActive("/gallery")
                                ? "bg-primary"
                                : "hover:bg-white hover:bg-opacity-10 hover:text-primary"
                        }`}
                    >
                        Gallery
                    </Link>
                </li>
                {/*
          <li className="px-5 py-2 md:p-0">
          <Link
              href="/#founders"
              className={`nav-link rounded-md md:px-4 md:py-2 text-white ${
                  pathname === "/#founders"
                      ? "bg-primary"
                      : "hover:bg-white hover:bg-opacity-10 hover:text-primary"
              }`}
          >
            Team
          </Link>
        </li>
        */}

                <li className="px-5 py-2 md:p-0">
                    <Link
                        href="/#map"
                        className={`nav-link rounded-md md:px-4 md:py-2 text-white hover:bg-white hover:bg-opacity-10 hover:text-primary`}
                        onClick={handleMapClick}
                    >
                        Map
                    </Link>
                </li>

                <li className="px-5 py-2 md:p-0">
                    <Link
                        href="/report"
                        className={`nav-link rounded-md md:px-4 md:py-2 text-white ${
                            isActive("/report")
                                ? "bg-primary"
                                : "hover:bg-white hover:bg-opacity-10 hover:text-primary"
                        }`}
                    >
                        Report
                    </Link>
                </li>
            </ul>

            <div className="hidden md:block">
                {openUploadModal && (
                    <button
                        onClick={openUploadModal}
                        className="transition-transform duration-300 hover:rotate-12"
                        aria-label="Upload"
                    >
                        <Image src="/resources/camera_icon.png" alt="Upload" width={50} height={50}/>
                    </button>
                )}
            </div>
        </nav>
    )
}