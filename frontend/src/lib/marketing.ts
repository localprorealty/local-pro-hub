import { domToCanvas, waitUntilLoad } from 'modern-screenshot'
import { jsPDF } from 'jspdf'

import { api } from '@/lib/api'
import type {
  MarketingPageType,
  NeighborhoodGuide,
} from '@/lib/marketing-types'

export class MarketingExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarketingExportError'
  }
}

function readExportSize(element: HTMLElement): { width: number; height: number } {
  const width = Number(element.dataset.exportWidth) || element.offsetWidth
  const height = Number(element.dataset.exportHeight) || element.offsetHeight
  if (!width || !height) {
    throw new MarketingExportError('Export target has no dimensions.')
  }
  return { width, height }
}

/** Briefly move the export node on-screen so capture libraries paint text reliably. */
function prepareExportElement(source: HTMLElement): () => void {
  const snapshot = {
    position: source.style.position,
    left: source.style.left,
    top: source.style.top,
    zIndex: source.style.zIndex,
    visibility: source.style.visibility,
    pointerEvents: source.style.pointerEvents,
  }

  source.style.position = 'fixed'
  source.style.left = '0'
  source.style.top = '0'
  source.style.zIndex = '-1'
  source.style.visibility = 'visible'
  source.style.pointerEvents = 'none'

  return () => {
    source.style.position = snapshot.position
    source.style.left = snapshot.left
    source.style.top = snapshot.top
    source.style.zIndex = snapshot.zIndex
    source.style.visibility = snapshot.visibility
    source.style.pointerEvents = snapshot.pointerEvents
  }
}

/**
 * Capture the hidden full-size export node (not the CSS-scaled preview).
 * Uses modern-screenshot so Tailwind v4 / oklab styles are preserved.
 */
async function captureExportNode(
  elementId: string,
  scale: number,
): Promise<HTMLCanvasElement> {
  const source = document.getElementById(elementId)
  if (!source) {
    throw new MarketingExportError(`Export element #${elementId} not found.`)
  }

  const { width, height } = readExportSize(source)
  const backgroundColor = source.dataset.exportBg ?? '#ffffff'

  const restore = prepareExportElement(source)

  try {
    await waitUntilLoad(source, { timeout: 30_000 })
    if (document.fonts?.ready) {
      await document.fonts.ready
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    return await domToCanvas(source, {
      width,
      height,
      scale,
      backgroundColor,
      timeout: 30_000,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Capture failed'
    throw new MarketingExportError(`Export capture failed: ${message}`)
  } finally {
    restore()
  }
}

function triggerDownload(href: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = href
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function downloadAsImage(
  elementId: string,
  filename: string,
  scale = 2,
): Promise<void> {
  const canvas = await captureExportNode(elementId, scale)
  let dataUrl: string
  try {
    dataUrl = canvas.toDataURL('image/png')
  } catch {
    throw new MarketingExportError('Could not encode PNG. Images may be blocked by CORS.')
  }
  triggerDownload(dataUrl, `${filename}.png`)
}

export async function downloadAsPdf(
  elementId: string,
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
): Promise<void> {
  const canvas = await captureExportNode(elementId, 1.5)
  let imgData: string
  try {
    imgData = canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    throw new MarketingExportError('Could not encode PDF image. Images may be blocked by CORS.')
  }
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [canvas.width, canvas.height],
  })
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
  pdf.save(`${filename}.pdf`)
}

export async function downloadListingBookPDF(
  pageIds: string[],
  filename: string,
): Promise<void> {
  if (pageIds.length === 0) {
    throw new MarketingExportError('No listing book pages to export.')
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4',
  })

  let pageIndex = 0

  for (const pageId of pageIds) {
    const canvas = await captureExportNode(pageId, 1.5)
    let imgData: string
    try {
      imgData = canvas.toDataURL('image/jpeg', 0.92)
    } catch {
      throw new MarketingExportError(`Could not encode page ${pageId} for PDF.`)
    }
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width

    if (pageIndex > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
    pageIndex += 1
  }

  pdf.save(`${filename}.pdf`)
}

export async function refineMarketingContent(
  listingId: string,
  payload: {
    page_type: MarketingPageType
    current_content: string
    instruction: string
    listing_context: Record<string, string>
  },
): Promise<string> {
  const result = await api<{ content: string }>(
    `/listings/${listingId}/marketing/refine`,
    { method: 'POST', body: payload },
  )
  const content = result.content?.trim()
  if (!content) {
    throw new MarketingExportError('AI returned empty content.')
  }
  return content
}

export async function fetchNeighborhoodGuide(
  listingId: string,
): Promise<NeighborhoodGuide> {
  return api<NeighborhoodGuide>(
    `/listings/${listingId}/marketing/neighborhood-guide`,
    { method: 'POST', body: {} },
  )
}

export function formatCommuteTimes(guide: NeighborhoodGuide): string {
  return guide.commute_times
    .map((item) => `${item.destination}: ${item.time}`)
    .join('\n')
}

export function parseCommuteTimes(text: string): NeighborhoodGuide['commute_times'] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(':')
      if (colon === -1) return { destination: line, time: '' }
      return {
        destination: line.slice(0, colon).trim(),
        time: line.slice(colon + 1).trim(),
      }
    })
}
