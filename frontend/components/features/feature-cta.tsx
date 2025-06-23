"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

interface FeaturesCTAProps {
  onUploadClick: () => void
}

export default function FeaturesCTA({ onUploadClick }: FeaturesCTAProps) {
  return (
    <div className="text-center mt-16">
      <div className="bg-gradient-to-r from-cat-orange/10 to-primary/10 rounded-3xl p-8 md:p-12 border border-cat-orange/20">
        <h3 className="text-3xl md:text-4xl font-bold text-cat-brown mb-4">Ready to Make a Difference?</h3>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Join thousands of cat lovers who are already helping stray cats in their communities. Every photo shared makes
          a difference.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={onUploadClick}
            className="bg-gradient-to-r from-cat-orange to-primary text-white px-8 py-3 text-lg rounded-full hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            Upload Your First Photo
          </Button>
          <Link href="/gallery">
            <Button
              variant="outline"
              className="border-2 border-cat-orange text-cat-brown px-8 py-3 text-lg rounded-full hover:bg-cat-orange hover:text-white transition-all duration-300 hover:scale-105"
            >
              Explore Gallery
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}