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
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl sm:rounded-3xl sm:hover:scale-105"
      onClick={(e) => {
        e.stopPropagation()
        onToggleOverlay()
      }}
    >
      <div className="relative aspect-[4/5] w-full">
        <Image
          src={item.src || "/placeholder.svg"}
          alt={`Cat ${item.id}`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          unoptimized
        />
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-2 py-3 text-center text-white transition-opacity duration-200 sm:px-4 ${
            overlayOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <p className="text-[10px] font-semibold leading-tight sm:text-sm md:text-base">
            {new Date(item.createdAt).toISOString().slice(0, 10)}
          </p>
          <p className="mt-0.5 text-[9px] sm:mt-1 sm:text-xs md:text-sm">{getCatStatusLabel(item.catStatus)}</p>
          <p className="mt-0.5 truncate text-[9px] sm:mt-1 sm:text-xs md:text-sm">
            {item.accountId ? `@${item.accountId}` : "Anonymous"}
          </p>
          {item.userId === null && (
            <Button
              variant="destructive"
              size="sm"
              className="mt-2 h-7 px-2 text-[10px] sm:mt-3 sm:h-8 sm:text-xs"
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
        className="flex shrink-0 items-center justify-center gap-1 border-t border-gray-100 bg-white py-2 sm:gap-2 sm:py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full p-1.5 transition sm:p-2 ${
            item.likedByMe ? "text-red-500" : "text-gray-500 hover:text-red-500"
          }`}
          onClick={onLikeClick}
          disabled={item.isLikeLoading}
          aria-label={item.likedByMe ? "Unlike post" : "Like post"}
        >
          <Heart className="h-5 w-5 sm:h-6 sm:w-6" fill={item.likedByMe ? "currentColor" : "none"} />
        </button>
        <span className="text-xs font-medium text-gray-700 sm:text-sm">{item.likeCount}</span>
      </div>
    </div>
  )
}
