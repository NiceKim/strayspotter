"use client"

import type React from "react"

import { useState } from "react"
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import Image from "next/image"
import { ImagePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { uploadImage } from "@/services/api"
import { useToast } from "@/hooks/use-toast"
import { useDataRefresh } from "@/contexts/DataRefreshContext"
import { useAuth } from "@/contexts/AuthContext"
import { categoryToStatus, type CatCategory } from "@/lib/utils"

export default function UploadModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<CatCategory>("good")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [anonymousNickname, setAnonymousNickname] = useState<string>("guest")
  const [anonymousPassword, setAnonymousPassword] = useState<string>("")
  const { toast } = useToast()
  const { refreshData } = useDataRefresh()
  const { isAuthenticated, token, refreshToken } = useAuth()

  useBodyScrollLock(isOpen)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file)
    } else if (file) {
      toast({
        title: "Invalid file type",
        description: "Please drop an image file (JPG, PNG, HEIC, etc.)",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile) return

    const formData = new FormData()
    formData.append("image", selectedFile)
    formData.append("status", categoryToStatus(selectedCategory).toString())

    if (!isAuthenticated && anonymousNickname && anonymousPassword) {
      formData.append("anonymousNickname", anonymousNickname)
      formData.append("anonymousPassword", anonymousPassword)
    }

    try {
      setIsUploading(true)
      await uploadImage(formData, token)
      setSelectedFile(null)
      onClose()
      refreshData()
      toast({
        title: "Upload successful",
        description: "Your cat photo has been uploaded successfully!",
      })
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? (error as { status: number }).status : undefined
      if (status === 401 && isAuthenticated) {
        const newToken = await refreshToken()
        if (newToken) {
          const retryFormData = new FormData()
          retryFormData.append("image", selectedFile)
          retryFormData.append("status", categoryToStatus(selectedCategory).toString())
          try {
            await uploadImage(retryFormData, newToken)
            setSelectedFile(null)
            onClose()
            refreshData()
            toast({
              title: "Upload successful",
              description: "Your cat photo has been uploaded successfully!",
            })
          } catch {
            toast({
              title: "Upload failed",
              description: "There was an error uploading your photo. Please try again.",
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: "Session expired",
            description: "Please log in again to upload.",
            variant: "destructive",
          })
        }
      } else {
        console.error("Upload failed:", error)
        toast({
          title: "Upload failed",
          description: "There was an error uploading your photo. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card className="flex max-h-[min(90dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border-none shadow-2xl">
        <CardHeader className="relative shrink-0 bg-cat-orange/10 rounded-t-2xl px-4 py-4 sm:px-6">
          <CardTitle className="pr-10 text-center text-xl font-bold text-cat-brown sm:text-2xl">
            Upload Your Cat Photo
          </CardTitle>
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1 hover:bg-cat-orange/20 transition-colors sm:right-4 sm:top-4"
            aria-label="Close"
          >
            <X className="h-6 w-6 text-cat-brown" />
          </button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="imageInput" className="text-cat-brown font-medium">
                Select an image
              </Label>
              <input
                type="file"
                id="imageInput"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />

              {/* Mobile: compact button — no drag-and-drop */}
              <div className="space-y-2 md:hidden">
                <label
                  htmlFor="imageInput"
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-cat-orange/40 bg-cat-orange/5 px-4 py-3 text-sm font-medium text-cat-brown transition-colors active:bg-cat-orange/15"
                >
                  <ImagePlus className="h-5 w-5 shrink-0 text-cat-orange" aria-hidden />
                  {selectedFile ? "Change photo" : "Choose a photo"}
                </label>
                {selectedFile ? (
                  <div className="rounded-lg border border-cat-orange/20 bg-gray-50/80 px-3 py-2 text-cat-brown">
                    <p className="truncate text-xs font-medium" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <p className="text-center text-xs text-gray-500">JPG, PNG, HEIC · up to 10MB</p>
                )}
              </div>

              {/* Desktop / tablet: drag-and-drop zone */}
              <div
                className={`hidden border-2 border-dashed rounded-lg p-6 text-center transition-colors md:block md:p-8 ${
                  isDragActive ? "border-cat-orange bg-cat-orange/10" : "border-cat-orange/50 hover:border-cat-orange"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <label htmlFor="imageInput" className="cursor-pointer flex flex-col items-center">
                  {selectedFile ? (
                    <div className="text-cat-brown">
                      <p className="font-medium break-all">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 rounded-full bg-cat-orange/20 p-3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6 text-cat-orange"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                      </div>
                      <span className="text-cat-brown">{isDragActive ? "Drop image here" : "Click or drag image here"}</span>
                      <span className="text-xs text-gray-500 mt-1">JPG, PNG, HEIC up to 10MB</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-cat-brown">Cat Status</h3>
              <p className="text-sm text-gray-500">Please choose an icon that best matches your cat's condition</p>

              <RadioGroup
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value as CatCategory)}
                className="flex justify-center gap-2 sm:gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <RadioGroupItem value="good" id="good" className="sr-only" />
                    <Label htmlFor="good" className="cursor-pointer">
                      <div
                        className={`h-16 w-16 overflow-hidden rounded-full border-2 bg-green-200 transition-all sm:h-20 sm:w-20 ${selectedCategory === "good" ? "border-primary shadow-lg" : "border-transparent"}`}
                      >
                        <Image
                          src="/resources/happy.png"
                          alt="Good"
                          width={60}
                          height={60}
                          className="h-full w-full object-cover p-2"
                        />
                      </div>
                    </Label>
                  </div>
                  <span className="mt-1 text-xs font-medium">Good</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative">
                    <RadioGroupItem value="concerned" id="concerned" className="sr-only" />
                    <Label htmlFor="concerned" className="cursor-pointer">
                      <div
                        className={`h-16 w-16 overflow-hidden rounded-full border-2 bg-yellow-200 transition-all sm:h-20 sm:w-20 ${selectedCategory === "concerned" ? "border-primary shadow-lg" : "border-transparent"}`}
                      >
                        <Image
                          src="/resources/worry.png"
                          alt="Concerned"
                          width={80}
                          height={80}
                          className="h-full w-full object-cover p-2"
                        />
                      </div>
                    </Label>
                  </div>
                  <span className="mt-1 text-xs font-medium">Concerned</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative">
                    <RadioGroupItem value="critical" id="critical" className="sr-only" />
                    <Label htmlFor="critical" className="cursor-pointer">
                      <div
                        className={`h-16 w-16 overflow-hidden rounded-full border-2 bg-red-200 transition-all sm:h-20 sm:w-20 ${selectedCategory === "critical" ? "border-primary shadow-lg" : "border-transparent"}`}
                      >
                        <Image
                          src="/resources/cry.png"
                          alt="Critical"
                          width={80}
                          height={80}
                          className="h-full w-full object-cover p-2"
                        />
                      </div>
                    </Label>
                  </div>
                  <span className="mt-1 text-xs font-medium">Critical</span>
                </div>
              </RadioGroup>
            </div>

            {!isAuthenticated && (
              <div className="space-y-3">
                <div className="space-y-3 rounded-lg border border-cat-orange/20 bg-gray-50 p-3 sm:p-4">
                  <div className="space-y-2">
                    <Label htmlFor="anonymousNickname" className="text-cat-brown font-medium">
                      Anonymous Nickname *
                    </Label>
                    <Input
                      id="anonymousNickname"
                      type="text"
                      value={anonymousNickname}
                      onChange={(e) => setAnonymousNickname(e.target.value)}
                      placeholder="Enter your nickname"
                      className="border-cat-orange/30 focus:border-cat-orange"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anonymousPassword" className="text-cat-brown font-medium">
                      Password *
                    </Label>
                    <Input
                      id="anonymousPassword"
                      type="password"
                      value={anonymousPassword}
                      onChange={(e) => setAnonymousPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="border-cat-orange/30 focus:border-cat-orange"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full rounded-xl bg-primary py-5 text-base font-medium text-white transition-all hover:scale-[1.02] hover:bg-primary/90 sm:py-6 sm:text-lg"
              disabled={!selectedFile || isUploading || (!isAuthenticated && (!anonymousNickname || !anonymousPassword))}
            >
              {isUploading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Uploading...
                </div>
              ) : (
                "Upload Photo"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

