"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import AuthModal from "@/components/auth-modal"
import { fetchGalleryImages, fetchImageUrl, deletePost, fetchPostLikes, likePost, unlikePost } from "@/services/api"
import { useDataRefresh } from "@/contexts/DataRefreshContext"
import { useAuth } from "@/contexts/AuthContext"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type GalleryItem = {
  id: string
  src: string
  createdAt: string
  catStatus: 0 | 1 | 2
  userId: number | null
  accountId: string | null
  likeCount: number
  likedByMe: boolean
  isLikeLoading: boolean
}

export default function GalleryPage() {
  const searchParams = useSearchParams()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GalleryItem | null>(null)
  const [anonymousPassword, setAnonymousPassword] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { refreshTrigger } = useDataRefresh()
  const { isAuthenticated, user } = useAuth()
  const isMineMode = searchParams.get("mine") === "1"

  const getCatStatusLabel = (status: 0 | 1 | 2) => {
    switch (status) {
      case 0:
        return "🐱 Good"
      case 1:
        return "⚠️ Concerned"
      case 2:
        return "🚨 Critical"
      default:
        return "❓ Unknown"
    }
  }

  const loadImages = async () => {
    setIsLoading(true)
    try {
      const posts = await fetchGalleryImages(12, 0, { mine: isMineMode })
      const items = await Promise.all(
        posts.map(async (post) => {
          const [imageData, likeCount] = await Promise.all([
            fetchImageUrl(post.picture_key),
            fetchPostLikes(post.id),
          ])
          return {
            id: String(post.id),
            src: imageData.url,
            createdAt: post.created_at,
            catStatus: post.cat_status,
            userId: post.user_id,
            accountId: post.account_id,
            likeCount,
            likedByMe: false,
            isLikeLoading: false,
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
  }, [refreshTrigger, isMineMode])

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)
  const openAuthModal = () => setIsAuthModalOpen(true)
  const closeAuthModal = () => setIsAuthModalOpen(false)

  const openDeleteModal = (item: GalleryItem) => {
    setDeleteTarget(item)
    setAnonymousPassword("")
    setDeleteError(null)
  }
  const closeDeleteModal = () => {
    setDeleteTarget(null)
    setAnonymousPassword("")
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deletePost(Number(deleteTarget.id), anonymousPassword)
      closeDeleteModal()
      setActiveId(null)
      await loadImages()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete post.")
    } finally {
      setIsDeleting(false)
    }
  }

  const loadMoreImages = async () => {
    const currentCount = galleryItems.length
    try {
      const posts = await fetchGalleryImages(currentCount + 6, 0, { mine: isMineMode })
      const newPosts = posts.slice(currentCount)

      const newItems = await Promise.all(
        newPosts.map(async (post) => {
          const [imageData, likeCount] = await Promise.all([
            fetchImageUrl(post.picture_key),
            fetchPostLikes(post.id),
          ])
          return {
            id: String(post.id),
            src: imageData.url,
            createdAt: post.created_at,
            catStatus: post.cat_status,
            userId: post.user_id,
            accountId: post.account_id,
            likeCount,
            likedByMe: false,
            isLikeLoading: false,
          }
        }),
      )

      setGalleryItems([...galleryItems, ...newItems])
    } catch (error) {
      console.error("Error loading more images:", error)
    }
  }

  const setLikeLoading = (itemId: string, isLikeLoading: boolean) => {
    setGalleryItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isLikeLoading } : item
      )
    )
  }

  const handleLikeClick = async (itemId: string) => {
    const target = galleryItems.find((item) => item.id === itemId)
    if (!target || target.isLikeLoading) return

    if (!isAuthenticated) {
      openAuthModal()
      return
    }

    const postId = Number(itemId)
    const shouldLike = !target.likedByMe
    setLikeLoading(itemId, true)

    try {
      const result = shouldLike ? await likePost(postId) : await unlikePost(postId)
      setGalleryItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item
          const nextCount = result.changed
            ? shouldLike
              ? item.likeCount + 1
              : Math.max(0, item.likeCount - 1)
            : item.likeCount
          return {
            ...item,
            likedByMe: shouldLike,
            likeCount: nextCount,
          }
        })
      )
    } catch (error) {
      const status = (error as { status?: number })?.status
      if (status === 401) {
        openAuthModal()
      } else {
        console.error("Failed to update like:", error)
      }
    } finally {
      setLikeLoading(itemId, false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5dc]">
      <Navbar openUploadModal={openUploadModal} openAuthModal={openAuthModal} />

      <UploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Delete Anonymous Post</h3>
            <p className="mt-2 text-sm text-gray-600">
              Enter the password you set when uploading.
            </p>
            <div className="mt-4">
              <Label htmlFor="anonymous-password">Password</Label>
              <Input
                id="anonymous-password"
                type="password"
                value={anonymousPassword}
                onChange={(e) => setAnonymousPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1"
                autoFocus
              />
            </div>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="mt-6 flex gap-2 justify-end">
              <Button variant="outline" onClick={closeDeleteModal} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={!anonymousPassword.trim() || isDeleting}
              >
                {isDeleting ? "Deleting..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div id="aesthetic" className="mx-auto my-16 max-w-7xl rounded-4xl bg-[#10403B] px-4 py-2 shadow-2xl">
        <div className="rounded-4xl bg-white p-8" onClick={() => setActiveId(null)}>
          {isMineMode && (
            <div className="mb-4 text-left">
              <h2 className="text-xl font-bold text-gray-900">
                {user?.accountId ? `@ ${user.accountId}` : "My posts"}
              </h2>
            </div>
          )}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-xl">Loading gallery images...</p>
            </div>
          ) : galleryItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-xl">
                {isMineMode
                  ? "No posts found. Upload your first photo!"
                  : "No images found. Be the first to upload!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
              {galleryItems.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-3xl shadow-xl h-[500px] bg-white transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveId((prev) => (prev === item.id ? null : item.id))
                  }}
                >
                  <div className="relative w-full h-[430px]">
                    <Image
                      src={item.src || "/placeholder.svg"}
                      alt={`Cat ${item.id}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div
                      className={`absolute inset-0 bg-black/60 text-white flex flex-col items-center justify-center px-4 text-center transition-opacity duration-200 ${
                        activeId === item.id ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                    >
                      <p className="text-lg font-semibold">
                        {new Date(item.createdAt).toISOString().slice(0, 10)}
                      </p>
                      <p className="mt-1 text-sm">
                        {getCatStatusLabel(item.catStatus)}
                      </p>
                      <p className="mt-2 text-md">
                        {item.accountId ? `@${item.accountId}` : "Anonymous"}
                      </p>
                      {item.userId === null && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="mt-4"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteModal(item)
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
                      onClick={() => handleLikeClick(item.id)}
                      disabled={item.isLikeLoading}
                      aria-label={item.likedByMe ? "Unlike post" : "Like post"}
                    >
                      <Heart
                        className="h-6 w-6"
                        fill={item.likedByMe ? "currentColor" : "none"}
                      />
                    </button>
                    <span className="text-sm font-medium text-gray-700">{item.likeCount}</span>
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

