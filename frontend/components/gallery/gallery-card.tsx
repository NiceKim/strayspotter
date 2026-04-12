"use client"

import Image from "next/image"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GalleryItem } from "@/lib/gallery"
import { getCatStatusLabel } from "@/lib/gallery"

type GalleryCardProps = {
  item: GalleryItem
  overlayOpen: boolean
  onToggleOverlay: () => void
  onDeleteClick: () => void
  onLikeClick: () => void
}

export function GalleryCard({
  item,
  overlayOpen,
  onToggleOverlay,
  onDeleteClick,
  onLikeClick,
}: GalleryCardProps) {
  return (
    <div
      className="h-[500px] cursor-pointer overflow-hidden rounded-3xl bg-white shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl"
      onClick={(e) => {
        e.stopPropagation()
        onToggleOverlay()
      }}
    >
      <div className="relative h-[430px] w-full">
        <Image
          src={item.src || "/placeholder.svg"}
          alt={`Cat ${item.id}`}
          fill
          className="object-cover"
          unoptimized
        />
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-4 text-center text-white transition-opacity duration-200 ${
            overlayOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <p className="text-lg font-semibold">
            {new Date(item.createdAt).toISOString().slice(0, 10)}
          </p>
          <p className="mt-1 text-sm">{getCatStatusLabel(item.catStatus)}</p>
          <p className="mt-2 text-md">{item.accountId ? `@${item.accountId}` : "Anonymous"}</p>
          {item.userId === null && (
            <Button
              variant="destructive"
              size="sm"
              className="mt-4"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteClick()
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div
        className="flex h-[70px] items-center justify-center gap-2 border-t border-gray-100 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full p-2 transition ${
            item.likedByMe ? "text-red-500" : "text-gray-500 hover:text-red-500"
          }`}
          onClick={onLikeClick}
          disabled={item.isLikeLoading}
          aria-label={item.likedByMe ? "Unlike post" : "Like post"}
        >
          <Heart className="h-6 w-6" fill={item.likedByMe ? "currentColor" : "none"} />
        </button>
        <span className="text-sm font-medium text-gray-700">{item.likeCount}</span>
      </div>
    </div>
  )
}
