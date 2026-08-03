import type { CSSProperties, ReactNode } from 'react'

/** Off-screen position for full-size export nodes (still painted for html2canvas). */
const EXPORT_OFFSCREEN_LEFT = -20000

type MarketingPreviewFrameProps = {
  exportId: string
  width: number
  height: number
  exportBg: string
  previewScale: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * Renders a scaled on-screen preview plus a hidden full-size duplicate for export.
 * Export capture must target the duplicate — never the CSS-scaled preview.
 */
export function MarketingPreviewFrame({
  exportId,
  width,
  height,
  exportBg,
  previewScale,
  className,
  style,
  children,
}: MarketingPreviewFrameProps) {
  const frameStyle: CSSProperties = {
    width,
    height,
    ...style,
  }

  return (
    <>
      <div
        className="mx-auto shrink-0 overflow-hidden"
        style={{
          width: Math.round(width * previewScale),
          height: Math.round(height * previewScale),
        }}
      >
        <div
          className={className}
          style={{
            ...frameStyle,
            transform: `scale(${previewScale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>

      <div
        id={exportId}
        data-export-width={String(width)}
        data-export-height={String(height)}
        data-export-bg={exportBg}
        className={className}
        style={{
          ...frameStyle,
          position: 'fixed',
          left: EXPORT_OFFSCREEN_LEFT,
          top: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden
      >
        {children}
      </div>
    </>
  )
}
