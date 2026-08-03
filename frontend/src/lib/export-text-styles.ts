import type { CSSProperties } from 'react'

/** Inline typography that survives export capture (no Tailwind tracking / opacity utilities). */
export const EXPORT_BODY_TEXT: CSSProperties = {
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  whiteSpace: 'normal',
  wordBreak: 'normal',
}

export const EXPORT_LABEL_CAPS: CSSProperties = {
  ...EXPORT_BODY_TEXT,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

export function exportNowrap(style?: CSSProperties): CSSProperties {
  return { ...EXPORT_BODY_TEXT, whiteSpace: 'nowrap', ...style }
}
