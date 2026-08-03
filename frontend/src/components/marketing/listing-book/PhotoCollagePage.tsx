import { BookPagePreviewFrame } from '@/components/marketing/listing-book/BookPagePreviewFrame'

type CollageLayout = 'single' | 'double' | 'triple' | 'quad'

function layoutForCount(count: number): CollageLayout {
  if (count <= 1) return 'single'
  if (count === 2) return 'double'
  if (count === 3) return 'triple'
  return 'quad'
}

type PhotoCollagePageProps = {
  photos: string[]
  pageId: string
  landscape?: boolean
}

export function PhotoCollagePage({
  photos,
  pageId,
  landscape = true,
}: PhotoCollagePageProps) {
  const layout = layoutForCount(photos.length)
  const width = landscape ? 1200 : 900
  const height = landscape ? 900 : 1200

  return (
    <BookPagePreviewFrame
      pageId={pageId}
      width={width}
      height={height}
      exportBg="#000000"
      className="overflow-hidden bg-black"
    >
      {layout === 'single' && photos[0] ? (
        <img src={photos[0]} alt="" className="size-full object-cover" />
      ) : null}

      {layout === 'double' ? (
        <div className="grid h-full grid-cols-2 gap-1">
          {photos.slice(0, 2).map((src, index) => (
            <img key={index} src={src} alt="" className="size-full object-cover" />
          ))}
        </div>
      ) : null}

      {layout === 'triple' ? (
        <div className="grid h-full grid-rows-2 gap-1">
          <img src={photos[0]} alt="" className="size-full object-cover" />
          <div className="grid grid-cols-2 gap-1">
            {photos.slice(1, 3).map((src, index) => (
              <img key={index} src={src} alt="" className="size-full object-cover" />
            ))}
          </div>
        </div>
      ) : null}

      {layout === 'quad' ? (
        <div className="grid h-full grid-cols-2 grid-rows-2 gap-1">
          {photos.slice(0, 4).map((src, index) => (
            <img key={index} src={src} alt="" className="size-full object-cover" />
          ))}
        </div>
      ) : null}
    </BookPagePreviewFrame>
  )
}
