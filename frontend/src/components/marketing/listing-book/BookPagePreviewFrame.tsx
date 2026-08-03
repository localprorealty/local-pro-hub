import type { CSSProperties, ReactNode } from 'react'

import { MarketingPreviewFrame } from '@/components/marketing/MarketingPreviewFrame'
import { bookPreviewScale } from '@/lib/marketing-preview'

type BookPagePreviewFrameProps = {
  pageId: string
  width: number
  height: number
  exportBg: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function BookPagePreviewFrame({
  pageId,
  width,
  height,
  exportBg,
  className,
  style,
  children,
}: BookPagePreviewFrameProps) {
  return (
    <MarketingPreviewFrame
      exportId={pageId}
      width={width}
      height={height}
      exportBg={exportBg}
      previewScale={bookPreviewScale(width)}
      className={className}
      style={style}
    >
      {children}
    </MarketingPreviewFrame>
  )
}
