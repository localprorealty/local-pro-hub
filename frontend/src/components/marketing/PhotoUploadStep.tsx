import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, Loader2, Star, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { compressImage } from '@/lib/image-compression'
import {
  fetchListingImages,
  uploadListingImage,
  updateListingImage,
  type ListingImage,
} from '@/lib/listing-images'
import {
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
  const [libraryImages, setLibraryImages] = useState<ListingImage[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [hasInitializedFromLibrary, setHasInitializedFromLibrary] = useState(false)

  const hasHero = photos.some((photo) => photo.category === 'hero')
  const isUploadingAny = photos.some((photo) => photo.isUploading)

  // 1. Fetch existing library images from Supabase
  const loadLibraryPhotos = useCallback(async () => {
    if (!listingId) return
    setIsLoadingLibrary(true)
    try {
      const images = await fetchListingImages(listingId)
      setLibraryImages(images)

      // Auto-populate marketing photos from library if marketing photos are currently empty
      if (photos.length === 0 && images.length > 0 && !hasInitializedFromLibrary) {
        const initialPhotos: PhotoUpload[] = images.map((img) => ({
          id: img.id,
          preview: img.public_url,
          category: (img.is_hero ? 'hero' : (img.category as PhotoCategory)) || 'other',
          photo_path: img.storage_path,
          isUploading: false,
        }))
        onPhotosChange(initialPhotos)
        setHasInitializedFromLibrary(true)
      }
    } catch (err) {
      console.warn('Unable to load listing images into marketing step:', err)
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [listingId, photos.length, hasInitializedFromLibrary, onPhotosChange])

  useEffect(() => {
    void loadLibraryPhotos()
  }, [loadLibraryPhotos])

  // Count library images that aren't yet in this marketing draft
  const unimportedCount = libraryImages.filter(
    (libImg) => !photos.some((p) => p.photo_path === libImg.storage_path || p.id === libImg.id)
  ).length

  const handleImportAllFromLibrary = () => {
    const missingPhotos: PhotoUpload[] = libraryImages
      .filter((libImg) => !photos.some((p) => p.photo_path === libImg.storage_path || p.id === libImg.id))
      .map((img) => ({
        id: img.id,
        preview: img.public_url,
        category: (img.is_hero ? 'hero' : (img.category as PhotoCategory)) || 'other',
        photo_path: img.storage_path,
        isUploading: false,
      }))

    if (missingPhotos.length > 0) {
      onPhotosChange((prev) => [...prev, ...missingPhotos])
    }
  }

  // 2. Handle file uploads with client-side compression & library upload
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || !listingId) return
      const selected = Array.from(files).filter((file) =>
        file.type.startsWith('image/') ||
        file.name.toLowerCase().endsWith('.heic') ||
        file.name.toLowerCase().endsWith('.heif')
      )

      if (selected.length === 0) return

      // Pre-allocate photo items with temporary object URLs and compression
      const newPhotos: PhotoUpload[] = selected.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        category: 'other',
        isUploading: true,
      }))

      onPhotosChange((prev) => [...prev, ...newPhotos])

      // Compress and upload each photo
      await Promise.all(
        newPhotos.map(async (photo) => {
          if (!photo.file) return

          try {
            // Client-side compression (2048px, WebP/JPEG, ~350KB)
            const compressed = await compressImage(photo.file, {
              maxDimension: 2048,
              quality: 0.85,
            })

            // Upload directly to Listing Image Library
            const uploaded = await uploadListingImage(listingId, compressed.file, {
              category: photo.category,
              is_hero: false,
            })

            onPhotosChange((prevPhotos) =>
              prevPhotos.map((p) =>
                p.id === photo.id
                  ? {
                      ...p,
                      id: uploaded.id,
                      isUploading: false,
                      photo_path: uploaded.storage_path,
                      preview: uploaded.public_url,
                    }
                  : p
              )
            )

            // Refresh library cache in background
            void fetchListingImages(listingId).then(setLibraryImages).catch(() => null)
          } catch (err) {
            console.error('[PhotoUploadStep] Upload failed:', err)
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
      )
    },
    [listingId, onPhotosChange],
  )

  const updateCategory = async (id: string, category: PhotoCategory) => {
    // If setting to hero, unset hero on any other photo
    onPhotosChange((prev) =>
      prev.map((photo) => {
        if (photo.id === id) {
          return { ...photo, category }
        }
        if (category === 'hero' && photo.category === 'hero') {
          return { ...photo, category: 'other' }
        }
        return photo
      })
    )

    // Sync to backend if listingId exists
    if (listingId) {
      try {
        await updateListingImage(listingId, id, {
          category,
          is_hero: category === 'hero',
        })
      } catch (err) {
        console.warn('Failed to sync category update to image library:', err)
      }
    }
  }

  const setAsHero = (id: string) => {
    void updateCategory(id, 'hero')
  }

  const removePhoto = (id: string) => {
    onPhotosChange((prev) => prev.filter((photo) => photo.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">
            Upload & Select Marketing Photos
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Assign each image to a room or category. Exactly one photo must be designated as Hero (exterior front).
          </p>
        </div>

        {unimportedCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImportAllFromLibrary}
            className="border-[var(--color-gold-border)] bg-[var(--color-gold-dim)] text-xs text-[var(--color-gold)] hover:bg-[var(--color-gold)] hover:text-black shrink-0"
          >
            Import {unimportedCount} photos from listing library
          </Button>
        ) : null}
      </div>

      {/* Drag and Drop Zone */}
      <div
        className="rounded-sm border border-dashed border-[var(--color-border)] bg-[#1a1a1a] p-8 text-center transition-colors hover:border-[var(--color-gold)]/50"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void handleFiles(event.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <ImagePlus className="mx-auto size-10 text-[var(--color-gold)]" />
        <p className="mt-3 text-sm font-medium text-white">Drag and drop photos here</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Unlimited photos · JPG, PNG, WebP, or HEIC · Auto-compressed for rapid generation
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-[var(--color-border)] bg-transparent text-white hover:bg-[#2a2a2a]"
          onClick={() => inputRef.current?.click()}
        >
          Choose photos to upload
        </Button>
      </div>

      {/* Photo Gallery Grid */}
      {photos.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Selected Photos ({photos.length})
            </span>
            {hasHero ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="size-3.5" />
                Hero exterior cover assigned
              </span>
            ) : (
              <span className="text-xs text-amber-300">
                ⚠️ No Hero photo assigned yet
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => {
              const isHero = photo.category === 'hero'
              const isHeadshot = photo.category === 'agent_headshot'

              return (
                <div
                  key={photo.id}
                  className={`group relative overflow-hidden rounded-sm border bg-[#141414] transition-all ${
                    isHero
                      ? 'border-[var(--color-gold)] shadow-[0_0_12px_rgba(207,184,124,0.2)]'
                      : 'border-[var(--color-border)] hover:border-neutral-600'
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-neutral-900">
                    <img
                      src={photo.preview}
                      alt="Property upload"
                      className="size-full object-cover"
                    />

                    {/* Badges */}
                    {isHero ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-[#CFB87C] px-2 py-0.5 text-[10px] font-bold text-black shadow">
                        <Star className="size-3 fill-black" />
                        HERO
                      </span>
                    ) : isHeadshot ? (
                      <span className="absolute left-2 top-2 rounded bg-indigo-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        HEADSHOT
                      </span>
                    ) : null}

                    {/* Set as Hero quick button */}
                    {!isHero && !photo.isUploading ? (
                      <button
                        type="button"
                        onClick={() => setAsHero(photo.id)}
                        className="absolute left-2 top-2 hidden items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[10px] font-medium text-amber-300 opacity-90 transition hover:bg-black group-hover:flex"
                        title="Set as Hero cover photo"
                      >
                        <Star className="size-3" />
                        Set Hero
                      </button>
                    ) : null}

                    {/* Uploading overlay */}
                    {photo.isUploading ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white">
                        <Loader2 className="size-6 animate-spin text-[#CFB87C]" />
                        <span className="mt-2 text-xs">Uploading & compressing...</span>
                      </div>
                    ) : null}

                    {/* Error overlay */}
                    {photo.error ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-2 text-center text-red-300">
                        <span className="text-xs font-semibold">Upload failed</span>
                        <span className="mt-1 text-[10px] line-clamp-2">{photo.error}</span>
                      </div>
                    ) : null}

                    {/* Remove photo button */}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute right-2 top-2 rounded-sm bg-black/70 p-1 text-white transition hover:bg-red-500/80"
                      aria-label="Remove photo"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Category Selector */}
                  <div className="p-3">
                    <Label className="text-[11px] text-[var(--color-text-secondary)]">Category</Label>
                    <Select
                      value={photo.category}
                      onValueChange={(value) => void updateCategory(photo.id, value as PhotoCategory)}
                      disabled={photo.isUploading}
                    >
                      <SelectTrigger className="mt-1 h-8 w-full border-[var(--color-border)] bg-[#0a0a0a] text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 border-[var(--color-border)] bg-[#141414] text-white">
                        {PHOTO_CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="text-xs">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : isLoadingLibrary ? (
        <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="mr-2 size-4 animate-spin text-[var(--color-gold)]" />
          Checking listing image library...
        </div>
      ) : null}

      {/* Footer Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
        <div>
          {!hasHero && photos.length > 0 ? (
            <p className="text-sm font-medium text-amber-300">
              ⚠️ Please designate at least one photo as Hero (exterior front) before proceeding.
            </p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Upload property photos to continue.
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          disabled={!hasHero || isUploadingAny}
          onClick={onContinue}
          className="h-11 rounded-sm bg-[#CFB87C] px-8 font-semibold text-[#0a0a0a] transition-all hover:bg-[#dcc487] disabled:opacity-50 shrink-0"
        >
          {isUploadingAny ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Processing photos...
            </>
          ) : (
            'Continue to preview →'
          )}
        </Button>
      </div>
    </div>
  )
}

export function PhotoUploadStepLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-[var(--color-text-secondary)]">
      <Loader2 className="mr-2 size-5 animate-spin text-[var(--color-gold)]" />
      Loading photos...
    </div>
  )
}
