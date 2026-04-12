"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/navbar"
import UploadModal from "@/components/upload-modal"
import AuthModal from "@/components/auth-modal"
import { GalleryCard } from "@/components/gallery/gallery-card"
import { DeleteAnonymousPostDialog } from "@/components/gallery/delete-anonymous-post-dialog"
import {
  fetchGalleryImages,
  deletePost,
  fetchMyPostsCount,
  likePost,
  unlikePost,
} from "@/services/api"
import { postsToGalleryItems, type GalleryItem } from "@/lib/gallery"
import { useDataRefresh } from "@/contexts/DataRefreshContext"
import { useAuth } from "@/contexts/AuthContext"

const INITIAL_PAGE_SIZE = 12
const LOAD_MORE_SIZE = 6

export default function GalleryPage() {
  const searchParams = useSearchParams()
  const isMineMode = searchParams.get("mine") === "1"

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GalleryItem | null>(null)
  const [anonymousPassword, setAnonymousPassword] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [myPostCount, setMyPostCount] = useState<number | null>(null)

  const { refreshTrigger } = useDataRefresh()
  const { isAuthenticated, user, isLoading: authLoading } = useAuth()

  const loadImages = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isMineMode) {
        setMyPostCount(await fetchMyPostsCount())
      } else {
        setMyPostCount(null)
      }

      const posts = await fetchGalleryImages(INITIAL_PAGE_SIZE, 0, { mine: isMineMode })
      setGalleryItems(await postsToGalleryItems(posts))
      setHasMore(posts.length === INITIAL_PAGE_SIZE)
    } catch (error) {
      console.error("Error loading gallery images:", error)
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }, [isMineMode])

  useEffect(() => {
    if (authLoading) return
    loadImages()
  }, [refreshTrigger, isMineMode, isAuthenticated, authLoading, loadImages])

  const loadMoreImages = async () => {
    if (isLoadingMore || !hasMore) return
    const offset = galleryItems.length
    setIsLoadingMore(true)
    try {
      const posts = await fetchGalleryImages(LOAD_MORE_SIZE, offset, { mine: isMineMode })
      const newItems = await postsToGalleryItems(posts)
      setGalleryItems((prev) => [...prev, ...newItems])
      setHasMore(newItems.length === LOAD_MORE_SIZE)
    } catch (error) {
      console.error("Error loading more images:", error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const setLikeLoading = (itemId: string, loading: boolean) => {
    setGalleryItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isLikeLoading: loading } : item)),
    )
  }

  const handleLikeClick = async (itemId: string) => {
    const target = galleryItems.find((item) => item.id === itemId)
    if (!target || target.isLikeLoading) return
    if (!isAuthenticated) {
      setIsAuthModalOpen(true)
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
          return { ...item, likedByMe: shouldLike, likeCount: nextCount }
        }),
      )
    } catch (error) {
      const status = (error as { status?: number })?.status
      if (status === 401) setIsAuthModalOpen(true)
      else console.error("Failed to update like:", error)
    } finally {
      setLikeLoading(itemId, false)
    }
  }

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

  const emptyMessage = isMineMode
    ? "No posts found. Upload your first photo!"
    : "No images found. Be the first to upload!"

  return (
    <div className="min-h-screen bg-cat-beige">
      <Navbar
        openUploadModal={() => setIsUploadModalOpen(true)}
        openAuthModal={() => setIsAuthModalOpen(true)}
      />

      <UploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {deleteTarget && (
        <DeleteAnonymousPostDialog
          password={anonymousPassword}
          error={deleteError}
          isDeleting={isDeleting}
          onPasswordChange={setAnonymousPassword}
          onClose={closeDeleteModal}
          onConfirm={handleConfirmDelete}
        />
      )}

      <div className="px-5 sm:px-8 md:px-10 lg:px-12">
        <div
          id="gallery-content"
          className="mx-auto my-16 max-w-7xl rounded-4xl bg-white px-5 py-10 shadow-2xl sm:px-8 sm:py-12 md:px-10 md:py-14"
          onClick={() => setActiveId(null)}
        >
          {isMineMode && (
            <header className="mb-4 text-left">
              <h2 className="text-xl font-bold text-gray-900">
                {user?.accountId ? `@ ${user.accountId}` : "My posts"}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{myPostCount ?? 0} Posts</p>
            </header>
          )}

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-xl">Loading gallery images...</p>
            </div>
          ) : galleryItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-xl">{emptyMessage}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {galleryItems.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  overlayOpen={activeId === item.id}
                  onToggleOverlay={() =>
                    setActiveId((prev) => (prev === item.id ? null : item.id))
                  }
                  onDeleteClick={() => openDeleteModal(item)}
                  onLikeClick={() => handleLikeClick(item.id)}
                />
              ))}
            </div>
          )}

          {galleryItems.length > 0 && hasMore && (
            <div className="mt-8 flex justify-center">
              <Button
                onClick={loadMoreImages}
                disabled={isLoadingMore}
                className="h-12 rounded-xl bg-primary px-8 text-xl font-bold text-white transition-all hover:scale-105 hover:bg-primary/90"
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
