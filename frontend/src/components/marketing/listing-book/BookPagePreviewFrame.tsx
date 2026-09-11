import { useContext, type CSSProperties, type ReactNode } from 'react'

import { MarketingPreviewFrame } from '@/components/marketing/MarketingPreviewFrame'
import { BookPreviewWidthContext } from '@/components/marketing/listing-book/BookPreviewContext'
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
  const maxAllowedWidth = useContext(BookPreviewWidthContext)

  return (
    <MarketingPreviewFrame
      exportId={pageId}
      width={width}
      height={height}
      exportBg={exportBg}
      previewScale={bookPreviewScale(width, maxAllowedWidth)}
      className={className}
      style={style}
    >
      {children}
    </MarketingPreviewFrame>
  )
}
