"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { uploadImage } from "@/services/api"
import { useToast } from "@/hooks/use-toast"

export default function UploadModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("happy")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile) return

    const formData = new FormData()
    formData.append("image", selectedFile)
    formData.append("status", selectedCategory)

    try {
      setIsUploading(true)
      await uploadImage(formData)

      toast({
        title: "Upload successful",
        description: "Your cat photo has been uploaded successfully!",
      })

      if (onSuccess) {
        onSuccess()
      }

      onClose()
    } catch (error) {
      console.error("Upload failed:", error)
      toast({
        title: "Upload failed",
        description: "There was an error uploading your photo. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <Card className="w-full max-w-md rounded-2xl border-none shadow-2xl">
        <CardHeader className="relative bg-cat-orange/10 rounded-t-2xl">
          <CardTitle className="text-center text-2xl font-bold text-cat-brown">Upload Your Cat Photo</CardTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 hover:bg-cat-orange/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6 text-cat-brown" />
          </button>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="imageInput" className="text-cat-brown font-medium">
                Select an image
              </Label>
              <div className="border-2 border-dashed border-cat-orange/50 rounded-lg p-8 text-center hover:border-cat-orange transition-colors">
                <input
                  type="file"
                  id="imageInput"
                  accept="image/*"
                  required
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="imageInput" className="cursor-pointer flex flex-col items-center">
                  {selectedFile ? (
                    <div className="text-cat-brown">
                      <p className="font-medium">{selectedFile.name}</p>
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
                      <span className="text-cat-brown">Click to browse files</span>
                      <span className="text-xs text-gray-500 mt-1">JPG, PNG, GIF up to 10MB</span>
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
                onValueChange={setSelectedCategory}
                className="flex justify-center gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <RadioGroupItem value="happy" id="happy" className="sr-only" />
                    <Label htmlFor="happy" className="cursor-pointer">
                      <div
                        className={`h-20 w-20 overflow-hidden rounded-full border-2 bg-green-200 transition-all ${selectedCategory === "happy" ? "border-primary shadow-lg" : "border-transparent"}`}
                      >
                        <Image
                          src="/resources/happy.png"
                          alt="Happy cat"
                          width={60}
                          height={60}
                          className="h-full w-full object-cover p-2"
                        />
                      </div>
                    </Label>
                  </div>
                  <span className="mt-1 text-xs font-medium">Happy</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative">
                    <RadioGroupItem value="normal" id="normal" className="sr-only" />
                    <Label htmlFor="normal" className="cursor-pointer">
                      <div
                        className={`h-20 w-20 overflow-hidden rounded-full border-2 bg-yellow-200 transition-all ${selectedCategory === "normal" ? "border-primary shadow-lg" : "border-transparent"}`}
                      >
                        <Image
                          src="/resources/worry.png"
                          alt="Normal cat"
                          width={80}
                          height={80}
                          className="h-full w-full object-cover p-2"
                        />
                      </div>
                    </Label>
                  </div>
                  <span className="mt-1 text-xs font-medium">Normal</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative">
                    <RadioGroupItem value="sad" id="sad" className="sr-only" />
                    <Label htmlFor="sad" className="cursor-pointer">
                      <div
                        className={`h-20 w-20 overflow-hidden rounded-full border-2 bg-red-200 transition-all ${selectedCategory === "sad" ? "border-primary shadow-lg" : "border-transparent"}`}
                      >
                        <Image
                          src="/resources/cry.png"
                          alt="Sad cat"
                          width={80}
                          height={80}
                          className="h-full w-full object-cover p-2"
                        />
                      </div>
                    </Label>
                  </div>
                  <span className="mt-1 text-xs font-medium">Needs Help</span>
                </div>
              </RadioGroup>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-white hover:bg-primary/90 hover:scale-105 transition-all rounded-xl py-6 text-lg font-medium"
              disabled={!selectedFile || !selectedCategory || isUploading}
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

