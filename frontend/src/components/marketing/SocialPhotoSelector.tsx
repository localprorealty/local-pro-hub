import { useRef } from 'react'
import { Check, Image as ImageIcon, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { PhotoUpload } from '@/lib/marketing-types'

export type SocialPhotoSelectorProps = {
  tabLabel: string
  photos: PhotoUpload[]
  selectedPhotoId: string | null
  onSelectPhoto: (photoId: string) => void
  onAddPhoto?: (file: File) => void
}

export function SocialPhotoSelector({
  tabLabel,
  photos,
  selectedPhotoId,
  onSelectPhoto,
  onAddPhoto,
}: SocialPhotoSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onAddPhoto) {
      onAddPhoto(file)
    }
    // reset input so same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Active photo is either explicit selectedPhotoId or the first 'hero' photo, or the first photo
  const effectiveSelectedId =
    selectedPhotoId ||
    photos.find((p) => p.category === 'hero')?.id ||
    photos[0]?.id ||
    null

  return (
    <aside className="w-full xl:w-[320px] shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded bg-[var(--color-gold-dim)] text-[var(--color-gold)]">
            <ImageIcon className="size-4" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Feature Photo</h3>
        </div>
        <span className="rounded border border-[var(--color-gold-border)] bg-[var(--color-gold-dim)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-gold)]">
          {tabLabel}
        </span>
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        Select which photo to showcase on your <strong>{tabLabel}</strong> post. Each social asset can have its own photo.
      </p>

      {/* Photo Gallery Grid */}
      <div className="mt-4">
        {photos.length === 0 ? (
          <div className="rounded border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-text-secondary)]">
            No photos uploaded yet. Upload a photo below to get started.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
            {photos.map((photo) => {
              const isSelected = photo.id === effectiveSelectedId

              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onSelectPhoto(photo.id)}
                  className={`group relative aspect-[4/3] w-full overflow-hidden rounded-md border text-left transition-all ${
                    isSelected
                      ? 'border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/50 shadow-md'
                      : 'border-[var(--color-border)] opacity-75 hover:opacity-100 hover:border-[var(--color-gold)]/60'
                  }`}
                >
                  <img
                    src={photo.preview}
                    alt={photo.category}
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />

                  {/* Dark gradient overlay at bottom for tag readability */}
                  <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/80 to-transparent" />

                  {/* Category label */}
                  <span className="absolute bottom-1 left-1.5 max-w-[85px] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium capitalize text-white backdrop-blur-xs">
                    {photo.category}
                  </span>

                  {/* Active Selected Checkmark */}
                  {isSelected && (
                    <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-[var(--color-gold)] text-black shadow-sm">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload Another Photo Button */}
      {onAddPhoto && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="w-full justify-center gap-2 border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
          >
            <Upload className="size-3.5" />
            Upload Another Photo
          </Button>
        </div>
      )}
    </aside>
  )
}
