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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <Card className="w-full max-w-md">
        <CardHeader className="relative">
          <CardTitle className="text-center text-2xl">Upload Your Cat Photo</CardTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="imageInput">Select an image</Label>
              <input
                type="file"
                id="imageInput"
                accept="image/*"
                required
                className="w-full cursor-pointer rounded-md border border-gray-300 px-3 py-2"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Cat Status</h3>
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
                        className={`h-20 w-20 overflow-hidden rounded-full border-2 bg-green-200 transition-all ${selectedCategory === "happy" ? "border-primary" : "border-transparent"}`}
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
                  <span className="mt-1 text-xs">Happy</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative">
                    <RadioGroupItem value="normal" id="normal" className="sr-only" />
                    <Label htmlFor="normal" className="cursor-pointer">
                      <div
                        className={`h-20 w-20 overflow-hidden rounded-full border-2 bg-yellow-200 transition-all ${selectedCategory === "normal" ? "border-primary" : "border-transparent"}`}
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
                  <span className="mt-1 text-xs">Normal</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative">
                    <RadioGroupItem value="sad" id="sad" className="sr-only" />
                    <Label htmlFor="sad" className="cursor-pointer">
                      <div
                        className={`h-20 w-20 overflow-hidden rounded-full border-2 bg-red-200 transition-all ${selectedCategory === "sad" ? "border-primary" : "border-transparent"}`}
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
                  <span className="mt-1 text-xs">Needs Help</span>
                </div>
              </RadioGroup>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-white hover:bg-primary/90"
              disabled={!selectedFile || !selectedCategory || isUploading}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

