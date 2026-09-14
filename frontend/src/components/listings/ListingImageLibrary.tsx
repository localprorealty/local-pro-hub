import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Plus,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  deleteListingImage,
  fetchListingImages,
  updateListingImage,
  uploadListingImage,
  type ListingImage,
} from '@/lib/listing-images'
import { compressImage } from '@/lib/image-compression'
import { PHOTO_CATEGORY_OPTIONS } from '@/lib/marketing-types'

type ListingImageLibraryProps = {
  listingId: string
  canManage?: boolean
  onImagesChange?: (images: ListingImage[]) => void
}

type UploadProgressItem = {
  id: string
  fileName: string
  status: 'compressing' | 'uploading' | 'done' | 'error'
  error?: string
  progressPreview?: string
}

export function ListingImageLibrary({
  listingId,
  canManage = true,
  onImagesChange,
}: ListingImageLibraryProps) {
  const [images, setImages] = useState<ListingImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadQueue, setUploadQueue] = useState<UploadProgressItem[]>([])
  const [activeLightboxImage, setActiveLightboxImage] = useState<ListingImage | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<ListingImage | null>(null)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null)
  const [captionDraft, setCaptionDraft] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImages = useCallback(async () => {
    if (!listingId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchListingImages(listingId)
      setImages(data)
      onImagesChange?.(data)
    } catch (err) {
      console.error('Failed to load listing images:', err)
      setError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      setIsLoading(false)
    }
  }, [listingId, onImagesChange])

  useEffect(() => {
    void loadImages()
  }, [loadImages])

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || !canManage) return

    const fileArray = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif'),
    )

    if (fileArray.length === 0) return

    const newQueueItems: UploadProgressItem[] = fileArray.map((f) => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      status: 'compressing',
    }))

    setUploadQueue((prev) => [...prev, ...newQueueItems])

    // Process uploads with client-side compression (up to 3 concurrently)
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const queueItem = newQueueItems[i]

      try {
        // Step 1: Compress on client (max 2048px, WebP/JPEG @ 85%)
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? { ...item, status: 'compressing' }
              : item,
          ),
        )

        const compressed = await compressImage(file, {
          maxDimension: 2048,
          quality: 0.85,
        })

        // Step 2: Upload to backend
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? {
                  ...item,
                  status: 'uploading',
                  progressPreview: compressed.previewUrl,
                }
              : item,
          ),
        )

        // If no hero exists yet, make the first uploaded image the hero
        const shouldBeHero = images.length === 0 && i === 0

        const uploaded = await uploadListingImage(listingId, compressed.file, {
          category: shouldBeHero ? 'hero' : 'other',
          is_hero: shouldBeHero,
        })

        setImages((prev) => {
          const next = shouldBeHero
            ? [...prev.map((img) => ({ ...img, is_hero: false })), uploaded]
            : [...prev, uploaded]
          onImagesChange?.(next)
          return next
        })

        setUploadQueue((prev) => prev.filter((item) => item.id !== queueItem.id))
      } catch (uploadErr) {
        console.error(`Upload failed for ${file.name}:`, uploadErr)
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? {
                  ...item,
                  status: 'error',
                  error: uploadErr instanceof Error ? uploadErr.message : 'Upload failed',
                }
              : item,
          ),
        )
      }
    }
  }

  const handleSetHero = async (image: ListingImage) => {
    if (!canManage) return
    try {
      // Optimistic update
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          is_hero: img.id === image.id,
          category: img.id === image.id ? 'hero' : img.category === 'hero' ? 'other' : img.category,
        })),
      )

      await updateListingImage(listingId, image.id, {
        is_hero: true,
        category: 'hero',
      })
    } catch (err) {
      console.error('Failed to set hero image:', err)
      void loadImages()
    }
  }

  const handleSetCategory = async (image: ListingImage, category: string) => {
    if (!canManage) return
    try {
      const isHero = category === 'hero'
      setImages((prev) =>
        prev.map((img) => {
          if (img.id === image.id) {
            return { ...img, category, is_hero: isHero }
          }
          if (isHero && img.is_hero) {
            return { ...img, is_hero: false }
          }
          return img
        }),
      )

      await updateListingImage(listingId, image.id, {
        category,
        is_hero: isHero,
        image_type: category === 'agent_headshot' ? 'headshot' : 'gallery',
      })
    } catch (err) {
      console.error('Failed to update category:', err)
      void loadImages()
    }
  }

  const handleSaveCaption = async (imageId: string) => {
    if (!canManage) return
    try {
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, caption: captionDraft } : img)),
      )
      setEditingCaptionId(null)
      await updateListingImage(listingId, imageId, {
        caption: captionDraft.trim() || null,
      })
    } catch (err) {
      console.error('Failed to update caption:', err)
      void loadImages()
    }
  }

  const confirmDeleteImage = async () => {
    if (!canManage || !imageToDelete) return
    setIsDeletingImage(true)
    try {
      const targetId = imageToDelete.id
      setImages((prev) => prev.filter((img) => img.id !== targetId))
      await deleteListingImage(listingId, targetId)
    } catch (err) {
      console.error('Failed to delete image:', err)
      void loadImages()
    } finally {
      setIsDeletingImage(false)
      setImageToDelete(null)
    }
  }

  const heroImage = images.find((img) => img.is_hero)
  const headshotImage = images.find((img) => img.category === 'agent_headshot' || img.image_type === 'headshot')

  return (
    <section className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold tracking-widest text-[var(--color-gold)] uppercase">
              Listing Media
            </p>
            <span className="rounded-full bg-[var(--color-surface-3)] px-2.5 py-0.5 text-[11px] font-medium text-white">
              {images.length} {images.length === 1 ? 'Photo' : 'Photos'}
            </span>
            {heroImage ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--color-gold)] border border-[var(--color-gold)]/30">
                <Star className="size-2.5 fill-current" /> Hero set
              </span>
            ) : null}
            {headshotImage ? (
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300 border border-blue-500/30">
                Headshot set
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Property Image Library
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            High-res property photos and headshot for marketing assets, flyers, and MLS.
          </p>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 gap-2 rounded-sm bg-[var(--color-gold)] px-4 text-xs font-semibold text-black hover:bg-[#dcc487]"
            >
              <Plus className="size-3.5" />
              Upload Photos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>
        ) : null}
      </div>

      {/* Upload Drag & Drop Zone */}
      {canManage ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            void handleFiles(e.dataTransfer.files)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed p-6 text-center transition-colors ${
            isDragging
              ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10'
              : 'border-[var(--color-border)] bg-[var(--color-surface)]/50 hover:border-[var(--color-gold)]/60 hover:bg-[var(--color-surface)]'
          }`}
        >
          <UploadCloud className="mb-2 size-8 text-[var(--color-gold)]" />
          <p className="text-xs font-medium text-white">
            Drag & drop property photos or agent headshot here, or click to browse
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            Auto-compressed to 2048px WebP for lightning-fast loads. No count limit.
          </p>
        </div>
      ) : null}

      {/* Upload Queue Progress */}
      {uploadQueue.length > 0 ? (
        <div className="mb-6 space-y-2 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <p className="text-xs font-medium text-[var(--color-gold)]">
            Processing uploads ({uploadQueue.length} remaining)...
          </p>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded bg-[var(--color-surface-2)] p-2 text-xs text-white"
              >
                <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--color-gold)]" />
                <span className="truncate flex-1">{item.fileName}</span>
                <span className="text-[10px] text-[var(--color-text-secondary)] capitalize">
                  {item.status}...
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="mr-2 size-4 animate-spin text-[var(--color-gold)]" />
          Loading listing images...
        </div>
      ) : error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          {error}
        </div>
      ) : images.length === 0 ? (
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] py-12 text-center text-xs text-[var(--color-text-secondary)]">
          <ImageIcon className="mx-auto mb-2 size-8 text-zinc-600" />
          No images uploaded for this listing yet. Use the upload area above to add photos.
        </div>
      ) : (
        /* Image Gallery Grid */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {images.map((image) => {
            const isHero = image.is_hero
            const isHeadshot = image.category === 'agent_headshot' || image.image_type === 'headshot'

            return (
              <div
                key={image.id}
                className={`group relative flex flex-col overflow-hidden rounded-sm border bg-[var(--color-surface)] transition-all ${
                  isHero
                    ? 'border-[var(--color-gold)] ring-1 ring-[var(--color-gold)] shadow-[0_0_12px_rgba(207,184,124,0.15)]'
                    : 'border-[var(--color-border)] hover:border-zinc-500'
                }`}
              >
                {/* Thumbnail Container */}
                <div className="relative aspect-4/3 w-full overflow-hidden bg-black/40">
                  <img
                    src={image.public_url}
                    alt={image.caption || image.category || 'Listing photo'}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
                    {isHero ? (
                      <span className="flex items-center gap-1 rounded bg-[var(--color-gold)] px-1.5 py-0.5 text-[9px] font-bold text-black shadow">
                        <Star className="size-2.5 fill-black" /> HERO
                      </span>
                    ) : null}
                    {isHeadshot ? (
                      <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                        HEADSHOT
                      </span>
                    ) : null}
                  </div>

                  {/* Hover Overlay Actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setActiveLightboxImage(image)}
                      title="View full size"
                      className="rounded bg-white/20 p-1.5 text-white hover:bg-white/40"
                    >
                      <Maximize2 className="size-3.5" />
                    </button>
                    {canManage && !isHero ? (
                      <button
                        type="button"
                        onClick={() => void handleSetHero(image)}
                        title="Set as Hero cover"
                        className="rounded bg-[var(--color-gold)] p-1.5 text-black hover:bg-[#dcc487]"
                      >
                        <Star className="size-3.5 fill-black" />
                      </button>
                    ) : null}
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => setImageToDelete(image)}
                        title="Delete photo"
                        className="rounded bg-red-600/80 p-1.5 text-white hover:bg-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Card Controls & Metadata */}
                <div className="flex flex-1 flex-col justify-between p-2.5 text-xs">
                  <div>
                    {/* Category Selector */}
                    {canManage ? (
                      <div className="mb-1.5">
                        <select
                          value={image.category}
                          onChange={(e) => void handleSetCategory(image, e.target.value)}
                          className="w-full truncate rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-1 text-[11px] text-zinc-300 focus:border-[var(--color-gold)] focus:outline-none"
                        >
                          {PHOTO_CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <p className="truncate text-[11px] text-[var(--color-text-secondary)] capitalize">
                        {image.category.replace('_', ' ')}
                      </p>
                    )}

                    {/* Inline Caption Editor */}
                    {editingCaptionId === image.id ? (
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={captionDraft}
                          onChange={(e) => setCaptionDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveCaption(image.id)
                            if (e.key === 'Escape') setEditingCaptionId(null)
                          }}
                          placeholder="Room caption..."
                          autoFocus
                          className="w-full rounded border border-[var(--color-gold)] bg-black px-1.5 py-0.5 text-[11px] text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveCaption(image.id)}
                          className="rounded bg-[var(--color-gold)] p-1 text-black"
                        >
                          <Check className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <p
                        onClick={() => {
                          if (!canManage) return
                          setEditingCaptionId(image.id)
                          setCaptionDraft(image.caption || '')
                        }}
                        title={canManage ? 'Click to edit caption' : undefined}
                        className={`truncate text-[11px] ${
                          canManage ? 'cursor-pointer hover:text-zinc-200' : ''
                        } ${image.caption ? 'text-zinc-300' : 'italic text-zinc-600'}`}
                      >
                        {image.caption || (canManage ? '+ Add caption...' : 'No caption')}
                      </p>
                    )}
                  </div>

                  {/* File info footer */}
                  <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)]/40 pt-1.5 text-[10px] text-zinc-500">
                    <span>
                      {image.file_size_bytes
                        ? `${Math.round(image.file_size_bytes / 1024)} KB`
                        : 'WebP'}
                    </span>
                    {isHero ? (
                      <span className="font-semibold text-[var(--color-gold)]">Primary Cover</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full-Screen Lightbox Modal */}
      {activeLightboxImage ? (
        <div
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-sm border border-[var(--color-border)] bg-[#111111]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-gold)]">
                  {activeLightboxImage.category.replace('_', ' ')}
                </span>
                {activeLightboxImage.caption ? (
                  <span className="text-xs text-zinc-300">· {activeLightboxImage.caption}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activeLightboxImage.public_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="rounded p-1.5 text-zinc-400 hover:text-white"
                >
                  <Download className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveLightboxImage(null)}
                  className="rounded p-1.5 text-zinc-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Image */}
            <div className="flex flex-1 items-center justify-center bg-black/60 p-4">
              <img
                src={activeLightboxImage.public_url}
                alt={activeLightboxImage.caption || 'Listing photo'}
                className="max-h-[75vh] w-auto max-w-full rounded object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
      {/* Confirm Image Delete Dialog */}
      <ConfirmDialog
        open={Boolean(imageToDelete)}
        onOpenChange={(open) => !open && setImageToDelete(null)}
        title="Delete image?"
        description="This image will be permanently removed from the listing library. This cannot be undone."
        confirmLabel="Delete image"
        variant="destructive"
        isLoading={isDeletingImage}
        onConfirm={confirmDeleteImage}
      />
    </section>
  )
}
