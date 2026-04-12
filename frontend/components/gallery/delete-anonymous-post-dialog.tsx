"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type DeleteAnonymousPostDialogProps = {
  password: string
  error: string | null
  isDeleting: boolean
  onPasswordChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function DeleteAnonymousPostDialog({
  password,
  error,
  isDeleting,
  onPasswordChange,
  onClose,
  onConfirm,
}: DeleteAnonymousPostDialogProps) {
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Delete Anonymous Post</h3>
        <p className="mt-2 text-sm text-gray-600">Enter the password you set when uploading.</p>
        <div className="mt-4">
          <Label htmlFor="anonymous-password">Password</Label>
          <Input
            id="anonymous-password"
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Enter password"
            className="mt-1"
            autoFocus
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!password.trim() || isDeleting}>
            {isDeleting ? "Deleting..." : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  )
}
