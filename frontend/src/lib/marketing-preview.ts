export const BOOK_PREVIEW_MAX_WIDTH = 480

export function bookPreviewScale(
  width: number,
  maxAllowedWidth: number = BOOK_PREVIEW_MAX_WIDTH,
): number {
  return Math.min(1, maxAllowedWidth / width)
}
