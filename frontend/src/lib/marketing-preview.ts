export const BOOK_PREVIEW_MAX_WIDTH = 480

export function bookPreviewScale(width: number): number {
  return Math.min(1, BOOK_PREVIEW_MAX_WIDTH / width)
}
