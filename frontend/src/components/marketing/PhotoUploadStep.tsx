import { useCallback, useRef } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  MAX_PHOTOS,
  PHOTO_CATEGORY_OPTIONS,
  type PhotoCategory,
  type PhotoUpload,
} from '@/lib/marketing-types'

type PhotoUploadStepProps = {
  listingId?: string
  photos: PhotoUpload[]
  onPhotosChange: (photos: PhotoUpload[] | ((prev: PhotoUpload[]) => PhotoUpload[])) => void
  onContinue: () => void
}

export function PhotoUploadStep({
  listingId,
  photos,
  onPhotosChange,
  onContinue,
}: PhotoUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasHero = photos.some((photo) => photo.category === 'hero')
  const isUploadingAny = photos.some((photo) => photo.isUploading)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || !listingId) return
      const remaining = MAX_PHOTOS - photos.length
      const selected = Array.from(files).slice(0, remaining)

      const newPhotos: PhotoUpload[] = []
      for (const file of selected) {
        if (!file.type.startsWith('image/')) continue
        const localPreview = URL.createObjectURL(file)
        newPhotos.push({
          id: crypto.randomUUID(),
          file,
          preview: localPreview,
          category: 'other',
          isUploading: true,
        })
      }

      if (newPhotos.length === 0) return

      onPhotosChange((prev) => [...prev, ...newPhotos])

      const uploadPromises = newPhotos.map(async (photo) => {
        const formData = new FormData()
        if (photo.file) {
          formData.append('file', photo.file)
        }

        try {
          const { getSupabaseClient } = await import('@/lib/supabase')
          const session = await getSupabaseClient().auth.getSession()
          const token = session.data.session?.access_token

          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/listings/${listingId}/marketing/upload-photo`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            }
          )

          if (!response.ok) {
            throw new Error(`Upload failed (${response.status})`)
          }

          const data = await response.json()

          onPhotosChange((prevPhotos) =>
            prevPhotos.map((p) =>
              p.id === photo.id
                ? {
                    ...p,
                    isUploading: false,
                    photo_path: data.photo_path,
                    preview: data.signed_url,
                  }
                : p
            )
          )
        } catch (err) {
          console.error(err)
          onPhotosChange((prevPhotos) =>
            prevPhotos.map((p) =>
              p.id === photo.id
                ? {
                    ...p,
                    isUploading: false,
                    error: err instanceof Error ? err.message : 'Upload failed',
                  }
                : p
            )
          )
        }
      })

      await Promise.all(uploadPromises)
    },
    [listingId, onPhotosChange, photos.length],
  )

  const updateCategory = (id: string, category: PhotoCategory) => {
    onPhotosChange((prev) =>
      prev.map((photo) => (photo.id === id ? { ...photo, category } : photo)),
    )
  }

  const removePhoto = (id: string) => {
    onPhotosChange((prev) => prev.filter((photo) => photo.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">
          Upload photographer photos
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Assign each image to a room or category. A hero exterior photo is required.
        </p>
      </div>

      <div
        className="rounded-md border border-dashed border-[var(--color-border)] bg-[#1a1a1a] p-8 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void handleFiles(event.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <ImagePlus className="mx-auto size-10 text-[#CFB87C]" />
        <p className="mt-3 text-sm text-white">Drag and drop photos here</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Up to {MAX_PHOTOS} images · JPG or PNG
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-[var(--color-border)] bg-transparent text-white hover:bg-[#2a2a2a]"
          onClick={() => inputRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
        >
          Choose files
        </Button>
      </div>

      {photos.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[#1a1a1a]"
            >
              <div className="relative aspect-[4/3]">
                <img
                  src={photo.preview}
                  alt="Upload preview"
                  className="size-full object-cover"
                />
                {photo.isUploading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white">
                    <Loader2 className="size-6 animate-spin text-[#CFB87C]" />
                    <span className="mt-2 text-xs">Uploading...</span>
                  </div>
                ) : null}
                {photo.error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-2 text-center text-red-300">
                    <span className="text-xs font-semibold">Error</span>
                    <span className="mt-1 text-[10px] line-clamp-2">{photo.error}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute right-2 top-2 rounded-sm bg-black/70 p-1 text-white hover:bg-black"
                  aria-label="Remove photo"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="p-3">
                <Label className="text-xs text-[var(--color-text-secondary)]">Category</Label>
                <Select
                  value={photo.category}
                  onValueChange={(value) => updateCategory(photo.id, value as PhotoCategory)}
                  disabled={photo.isUploading}
                >
                  <SelectTrigger className="mt-1 w-full border-[var(--color-border)] bg-[#0a0a0a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHOTO_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!hasHero || isUploadingAny}
          onClick={onContinue}
          className="h-11 rounded-sm bg-[#CFB87C] px-6 font-semibold text-[#0a0a0a] hover:bg-[#dcc487] disabled:opacity-50"
        >
          Continue to preview →
        </Button>
      </div>

      {!hasHero && photos.length > 0 ? (
        <p className="text-sm text-amber-300">Assign at least one photo as Hero (exterior front).</p>
      ) : null}
    </div>
  )
}

export function PhotoUploadStepLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-[var(--color-text-secondary)]">
      <Loader2 className="mr-2 size-5 animate-spin" />
      Loading...
    </div>
  )
}
