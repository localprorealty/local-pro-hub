import { createContext } from 'react'

import { BOOK_PREVIEW_MAX_WIDTH } from '@/lib/marketing-preview'

export const BookPreviewWidthContext = createContext<number>(BOOK_PREVIEW_MAX_WIDTH)
