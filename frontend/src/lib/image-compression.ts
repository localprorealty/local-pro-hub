/**
 * Client-side image compression utility for real estate photos.
 * 
 * Features:
 * - Resizes images to max 2048px on the longest dimension (preserving aspect ratio).
 * - Converts to high-quality WebP (or JPEG fallback) at 85% quality.
 * - Drastically reduces multi-megabyte DSLR / phone uploads (~15MB -> ~350-500KB).
 * - Graceful fallback: If an image format (e.g. raw HEIC on Chrome) cannot be decoded
 *   by browser canvas, it safely returns the original file without failing the upload.
 */

export type CompressOptions = {
  maxDimension?: number
  quality?: number
  preferredMimeType?: 'image/webp' | 'image/jpeg'
}

export type CompressedImageResult = {
  file: File
  previewUrl: string
  originalSizeBytes: number
  compressedSizeBytes: number
  width: number
  height: number
  wasCompressed: boolean
}

/**
 * Checks if the browser's canvas supports exporting to a given MIME type.
 */
function isMimeTypeSupported(mimeType: string): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const dataUrl = canvas.toDataURL(mimeType)
    return dataUrl.startsWith(`data:${mimeType}`)
  } catch {
    return false
  }
}

/**
 * Loads a File into an HTMLImageElement using an object URL.
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl)
      reject(err)
    }

    img.src = objectUrl
  })
}

/**
 * Compresses an image file in the browser before upload.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressedImageResult> {
  const maxDimension = options.maxDimension ?? 2048
  const quality = options.quality ?? 0.85
  const originalSize = file.size

  // Skip compression if already very small (< 250KB) and not huge in name
  if (originalSize <= 250 * 1024 && !file.name.toLowerCase().endsWith('.heic')) {
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      originalSizeBytes: originalSize,
      compressedSizeBytes: originalSize,
      width: 0,
      height: 0,
      wasCompressed: false,
    }
  }

  // Determine target MIME type (WebP preferred, fallback to JPEG)
  const targetMime =
    options.preferredMimeType ||
    (isMimeTypeSupported('image/webp') ? 'image/webp' : 'image/jpeg')

  try {
    const img = await loadImageFromFile(file)
    const naturalWidth = img.naturalWidth || img.width
    const naturalHeight = img.naturalHeight || img.height

    if (naturalWidth === 0 || naturalHeight === 0) {
      throw new Error('Invalid image dimensions')
    }

    // Calculate scaled dimensions
    let targetWidth = naturalWidth
    let targetHeight = naturalHeight

    if (naturalWidth > maxDimension || naturalHeight > maxDimension) {
      if (naturalWidth >= naturalHeight) {
        targetWidth = maxDimension
        targetHeight = Math.round((naturalHeight * maxDimension) / naturalWidth)
      } else {
        targetHeight = maxDimension
        targetWidth = Math.round((naturalWidth * maxDimension) / naturalHeight)
      }
    }

    // Render to canvas
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Could not obtain canvas 2D context')
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

    // Export blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, targetMime, quality)
    })

    if (!blob) {
      throw new Error('Canvas toBlob conversion failed')
    }

    // If compressed size is somehow larger than original, stick with original
    if (blob.size >= originalSize && originalSize > 0) {
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        originalSizeBytes: originalSize,
        compressedSizeBytes: originalSize,
        width: naturalWidth,
        height: naturalHeight,
        wasCompressed: false,
      }
    }

    // Generate output file with appropriate extension
    const ext = targetMime === 'image/webp' ? '.webp' : '.jpg'
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const compressedFile = new File([blob], `${baseName}${ext}`, {
      type: targetMime,
      lastModified: Date.now(),
    })

    return {
      file: compressedFile,
      previewUrl: URL.createObjectURL(blob),
      originalSizeBytes: originalSize,
      compressedSizeBytes: blob.size,
      width: targetWidth,
      height: targetHeight,
      wasCompressed: true,
    }
  } catch (error) {
    // Graceful fallback: If decoding fails (e.g., HEIC on Chrome), pass original file safely
    console.warn(
      `[ImageCompression] Could not compress ${file.name} (${file.type}). Using original file:`,
      error,
    )

    return {
      file,
      previewUrl: URL.createObjectURL(file),
      originalSizeBytes: originalSize,
      compressedSizeBytes: originalSize,
      width: 0,
      height: 0,
      wasCompressed: false,
    }
  }
}
