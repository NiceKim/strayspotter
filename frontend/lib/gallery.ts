import { fetchImageUrl, fetchPostLikes, type GalleryPost } from "@/services/api"

export type GalleryItem = {
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

export function getCatStatusLabel(status: 0 | 1 | 2): string {
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

/** Builds gallery rows (image URL + like summary) from API post rows. */
export async function postsToGalleryItems(posts: GalleryPost[]): Promise<GalleryItem[]> {
  return Promise.all(
    posts.map(async (post) => {
      const [imageData, likesInfo] = await Promise.all([
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
        likeCount: likesInfo.count,
        likedByMe: likesInfo.likedByMe,
        isLikeLoading: false,
      }
    }),
  )
}
