import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Bed,
  Bath,
  Maximize2,
  Calendar,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Circle,
  MessageSquare,
  Send,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
  Loader2,
  Building2,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import lpLogo from '@/assets/branding/LP_Gold.png'
import { useTheme } from '@/lib/theme'
import {
  fetchPublicListingShare,
  submitPublicComment,
  type PublicListingShareData,
  type PublicComment,
} from '@/lib/public-share'

export function PublicListingSharePage() {
  const { token } = useParams<{ token: string }>()
  const { theme, toggleTheme } = useTheme()

  const [data, setData] = useState<PublicListingShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Photo Gallery Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Comment submission form state
  const [commenterName, setCommenterName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentSuccess, setCommentSuccess] = useState(false)

  // Filter category for gallery
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setNotFound(false)
    setErrorMessage(null)

    fetchPublicListingShare(token)
      .then((res) => {
        if (isMounted) {
          setData(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setNotFound(true)
          setErrorMessage(err instanceof Error ? err.message : 'Listing not found.')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  // Touch swipe gesture navigation for photo lightbox
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const touchEndY = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchEndX.current = null
    touchEndY.current = null
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
    touchEndY.current = e.touches[0].clientY
  }

  const handleTouchEnd = () => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      touchEndX.current === null ||
      touchEndY.current === null ||
      !data?.photos?.length
    ) {
      return
    }

    const deltaX = touchEndX.current - touchStartX.current
    const deltaY = touchEndY.current - touchStartY.current
    const minHorizontalSwipeDistance = 40
    const minVerticalCloseDistance = 70

    // Horizontal swipe: |deltaX| > |deltaY|
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < -minHorizontalSwipeDistance) {
        // Swiped Left -> Next Photo
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % data.photos.length,
        )
      } else if (deltaX > minHorizontalSwipeDistance) {
        // Swiped Right -> Previous Photo
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + data.photos.length) % data.photos.length,
        )
      }
    } else {
      // Vertical swipe downward: deltaY > minVerticalCloseDistance -> Close Lightbox
      if (deltaY > minVerticalCloseDistance) {
        setLightboxIndex(null)
      }
    }

    touchStartX.current = null
    touchStartY.current = null
    touchEndX.current = null
    touchEndY.current = null
  }

  const scrollToAgentCard = () => {
    const card = document.getElementById('agent-contact-card')
    if (card) {
      card.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Keyboard navigation for photo lightbox
  useEffect(() => {
    if (lightboxIndex === null || !data?.photos?.length) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null)
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev === null ? null : (prev + 1) % data.photos.length))
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + data.photos.length) % data.photos.length,
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, data?.photos])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !commenterName.trim() || !commentText.trim()) return

    setSubmittingComment(true)
    setCommentError(null)
    setCommentSuccess(false)

    try {
      const newComment = await submitPublicComment(token, {
        commenter_name: commenterName.trim(),
        comment_text: commentText.trim(),
        hp_website: honeypot,
      })

      // Update local comments list if not a spam trap
      if (newComment.id !== 'spam-trap') {
        setData((prev) =>
          prev
            ? {
                ...prev,
                comments: [newComment, ...(prev.comments || [])],
              }
            : null,
        )
      }

      setCommentNameReset()
      setCommentSuccess(true)
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to submit comment.')
    } finally {
      setSubmittingComment(false)
    }
  }

  const setCommentNameReset = () => {
    setCommenterName('')
    setCommentText('')
    setHoneypot('')
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text)] flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <img
            src={lpLogo}
            alt="LocalPRO Realty"
            className="h-14 w-auto mx-auto object-contain animate-pulse"
          />
          <div className="flex items-center justify-center gap-3 text-sm text-[var(--color-gold)]">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading listing presentation...</span>
          </div>
        </div>
      </div>
    )
  }

  // 404 / Inactive Link State
  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text)] flex flex-col justify-between p-6">
        {/* Top Header */}
        <header className="max-w-4xl mx-auto w-full pt-8 flex items-center justify-between border-b border-[var(--color-border)] pb-6">
          <div className="flex items-center gap-3">
            <img src={lpLogo} alt="LocalPRO Realty" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-sm font-semibold tracking-wider text-[var(--color-text)] uppercase">
                LocalPRO Realty
              </h1>
              <p className="text-xs text-[var(--color-gold)]">A Modern Brokerage</p>
            </div>
          </div>
          <a
            href="https://localprorealty.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors flex items-center gap-1"
          >
            localprorealty.com <ExternalLink className="size-3" />
          </a>
        </header>

        {/* Center Card */}
        <main className="max-w-md mx-auto w-full my-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-8 text-center shadow-xl">
          <div className="size-12 rounded-full bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 text-[var(--color-gold)] flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Listing Unavailable</h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6">
            {errorMessage ||
              'This listing is currently private or the share link is inactive. If you are the property owner, please contact your LocalPRO agent for an updated link.'}
          </p>
          <a
            href="https://localprorealty.com"
            className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-black font-semibold text-xs tracking-wider uppercase rounded transition-colors"
          >
            Visit LocalPRO Realty
          </a>
        </main>

        {/* Footer */}
        <footer className="max-w-4xl mx-auto w-full border-t border-[var(--color-border)] pt-6 text-center text-xs text-[var(--color-text-secondary)]">
          <p>LocalPRO Realty • 5801 Headquarters Dr Ste 775, Plano, TX 75024 • (972) 996-5555</p>
        </footer>

        {/* Direct Theme Toggle */}
        <div className="fixed right-6 bottom-6 z-40">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex size-11 items-center justify-center rounded-full border border-[var(--color-gold-border)] bg-[var(--color-surface)] text-[var(--color-gold)] shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--color-gold)] hover:shadow-[0_0_16px_rgba(207,184,124,0.3)] active:scale-95 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="size-5 text-[var(--color-gold)]" />
            ) : (
              <Moon className="size-5 text-[var(--color-gold)]" />
            )}
          </button>
        </div>
      </div>
    )
  }

  // Gallery categorization
  const categories = ['all', ...Array.from(new Set(data.photos.map((p) => p.category)))]
  const filteredPhotos =
    selectedCategory === 'all'
      ? data.photos
      : data.photos.filter((p) => p.category === selectedCategory)

  // Primary cover photo
  const heroPhoto = data.photos.find((p) => p.is_hero) || data.photos[0]

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text)] font-sans antialiased selection:bg-[var(--color-gold)] selection:text-black">
      {/* 1. FIXED TOP BROKERAGE BRANDING HEADER */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)] px-4 lg:px-8 py-3.5 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={lpLogo}
              alt="LocalPRO Realty Logo"
              className="h-9 w-auto object-contain drop-shadow"
            />
            <div>
              <span className="text-sm font-bold tracking-wider text-[var(--color-text)] uppercase block leading-none">
                LocalPRO Realty
              </span>
              <span className="text-[11px] text-[var(--color-gold)] tracking-wide block mt-1">
                A Modern Brokerage • Dallas-Fort Worth
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-5 text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-[var(--color-gold)]" />
              5801 Headquarters Dr, Plano, TX
            </span>
            <span className="text-[var(--color-border)]">|</span>
            <a
              href="tel:9729965555"
              className="flex items-center gap-1.5 hover:text-[var(--color-gold)] transition-colors"
            >
              <Phone className="size-3.5 text-[var(--color-gold)]" />
              (972) 996-5555
            </a>
          </div>
        </div>
      </header>

      {/* 2. HERO IMAGE & PROPERTY HEADER */}
      <div className="relative bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Info Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 text-[var(--color-gold)] text-xs font-semibold tracking-wide uppercase">
                <Building2 className="size-3.5" />
                {data.specs.property_type || 'Residential Property'}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[var(--color-text)] tracking-tight leading-tight">
                {data.address_full}
              </h1>

              {data.specs.subdivision ? (
                <p className="text-sm sm:text-base text-[var(--color-text-secondary)] flex items-center gap-1.5">
                  <MapPin className="size-4 text-[var(--color-gold)]" />
                  Subdivision: {data.specs.subdivision}
                </p>
              ) : null}

              {/* Price Callout */}
              {data.list_price ? (
                <div className="pt-2">
                  <span className="text-xs tracking-widest text-[var(--color-text-secondary)] uppercase block">
                    Listing Price
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-[var(--color-gold)]">
                    ${Number(data.list_price).toLocaleString()}
                  </span>
                </div>
              ) : null}

              {/* Quick Specs Bar */}
              <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.specs.bedrooms ? (
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-3 text-center">
                    <Bed className="size-4 text-[var(--color-gold)] mx-auto mb-1" />
                    <span className="text-lg font-bold text-[var(--color-text)] block">
                      {data.specs.bedrooms}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">Beds</span>
                  </div>
                ) : null}

                {data.specs.bathrooms_full ? (
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-3 text-center">
                    <Bath className="size-4 text-[var(--color-gold)] mx-auto mb-1" />
                    <span className="text-lg font-bold text-[var(--color-text)] block">
                      {data.specs.bathrooms_full}
                      {data.specs.bathrooms_half ? `.${data.specs.bathrooms_half}` : ''}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">Baths</span>
                  </div>
                ) : null}

                {data.specs.square_feet ? (
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-3 text-center">
                    <Maximize2 className="size-4 text-[var(--color-gold)] mx-auto mb-1" />
                    <span className="text-lg font-bold text-[var(--color-text)] block">
                      {Number(data.specs.square_feet).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">Sq Ft</span>
                  </div>
                ) : null}

                {data.specs.year_built ? (
                  <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-3 text-center">
                    <Calendar className="size-4 text-[var(--color-gold)] mx-auto mb-1" />
                    <span className="text-lg font-bold text-[var(--color-text)] block">
                      {data.specs.year_built}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">Built</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right Hero Image Card */}
            <div className="lg:col-span-5">
              {heroPhoto ? (
                <div
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[var(--color-border)] shadow-2xl group cursor-pointer"
                  onClick={() => setLightboxIndex(0)}
                >
                  <img
                    src={heroPhoto.url}
                    alt={heroPhoto.caption || data.address_full}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                    <span className="bg-black/60 backdrop-blur px-2.5 py-1 rounded text-[var(--color-gold)] font-medium">
                      Primary Cover Photo
                    </span>
                    <span className="bg-black/60 backdrop-blur px-2.5 py-1 rounded text-stone-300">
                      Click to view {data.photos.length} photos
                    </span>
                  </div>
                </div>
              ) : (
                <div className="aspect-[4/3] rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col items-center justify-center p-6 text-center text-[var(--color-text-secondary)]">
                  <Building2 className="size-10 text-[var(--color-text-secondary)] mb-2" />
                  <p className="text-xs">Professional Photography in progress</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. LISTING LIFECYCLE / PIPELINE PROGRESS STEPPER */}
      <section className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] py-8">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-gold)]">
                Listing Lifecycle Progress
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Real-time milestone tracking from signing to MLS activation
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text)]">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Verified Status
            </span>
          </div>

          {/* Stepper Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.pipeline.map((step, idx) => {
              const isCompleted = step.status === 'completed'
              const isCurrent = step.status === 'current'

              return (
                <div
                  key={step.key}
                  className={`relative p-3.5 rounded-md border transition-all ${
                    isCurrent
                      ? 'bg-[var(--color-gold)]/10 border-[var(--color-gold)] text-[var(--color-text)] shadow-sm'
                      : isCompleted
                        ? 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]'
                        : 'bg-[var(--color-surface)]/60 border border-[var(--color-border)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-[var(--color-text-secondary)]">
                      Stage 0{idx + 1}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isCurrent ? (
                      <span className="size-2.5 rounded-full bg-[var(--color-gold)] animate-ping" />
                    ) : (
                      <Circle className="size-3 text-[var(--color-text-secondary)]/50" />
                    )}
                  </div>
                  <h3
                    className={`text-xs font-bold leading-snug ${
                      isCurrent ? 'text-[var(--color-gold)]' : isCompleted ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {step.label}
                  </h3>
                  <span className="text-[10px] block mt-1 capitalize font-medium opacity-80">
                    {step.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4. MAIN CONTENT: GALLERY, STORY, AGENT CARD, COMMENTS */}
      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Photos Gallery & Property Description */}
          <div className="lg:col-span-8 space-y-10">
            {/* PHOTO GALLERY SECTION */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)] tracking-wide">Property Gallery</h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">{data.photos.length} High-Resolution Photos</p>
                </div>

                {/* Filter pills if multiple categories */}
                {categories.length > 2 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded text-xs capitalize font-medium transition-colors ${
                          selectedCategory === cat
                            ? 'bg-[var(--color-gold)] text-black font-semibold'
                            : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {filteredPhotos.length === 0 ? (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-text-secondary)]">
                  <p className="text-sm">No photos available in this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredPhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-[4/3] rounded-md overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-border)] cursor-pointer shadow hover:border-[var(--color-gold)] transition-all"
                      onClick={() => setLightboxIndex(index)}
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || `Photo ${index + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                        <p className="text-xs text-white font-medium line-clamp-2 drop-shadow">
                          {photo.caption || `View Photo ${index + 1}`}
                        </p>
                      </div>
                      {photo.caption ? (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-[11px] text-stone-200 truncate">{photo.caption}</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* PROPERTY STORY / REMARKS SECTION */}
            {data.description ? (
              <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-6 sm:p-8 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-gold)] mb-4">
                  About This Property
                </h2>
                <div className="max-w-none text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-line">
                  {data.description}
                </div>
              </section>
            ) : null}

            {/* CLIENT & VISITOR FEEDBACK SECTION */}
            <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 text-[var(--color-gold)] flex items-center justify-center">
                    <MessageSquare className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--color-text)]">Client & Visitor Feedback</h2>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Leave questions, feedback, or private notes directly for the listing agent
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-[var(--color-gold)] bg-[var(--color-gold)]/10 px-2.5 py-1 rounded border border-[var(--color-gold)]/30">
                  {data.comments?.length || 0} Comments
                </span>
              </div>

              {/* Feedback Submission Form */}
              <form onSubmit={handleSubmitComment} className="space-y-4">
                {commentSuccess ? (
                  <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-600/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span>Thank you! Your feedback has been sent to the listing agent.</span>
                    <button
                      type="button"
                      onClick={() => setCommentSuccess(false)}
                      className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                ) : null}

                {commentError ? (
                  <div className="p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-600/40 text-xs text-red-800 dark:text-red-300">
                    {commentError}
                  </div>
                ) : null}

                {/* Honeypot anti-spam field (hidden from genuine users) */}
                <input
                  type="text"
                  name="hp_website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ display: 'none' }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium tracking-wide text-[var(--color-text-secondary)] uppercase block mb-1.5">
                      Your Name <span className="text-[var(--color-gold)]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Jane Doe (Homeowner) or Prospective Buyer"
                      value={commenterName}
                      onChange={(e) => setCommenterName(e.target.value)}
                      className="w-full h-10 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-gold)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium tracking-wide text-[var(--color-text-secondary)] uppercase block mb-1.5">
                    Your Feedback / Note <span className="text-[var(--color-gold)]">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Type your feedback, photo impressions, or showing inquiries here..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-gold)] resize-y min-h-[80px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingComment || !commenterName.trim() || !commentText.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-black font-semibold text-xs tracking-wider uppercase rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submittingComment ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Send Feedback
                    </>
                  )}
                </button>
              </form>

              {/* Comments Display List */}
              <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
                {!data.comments || data.comments.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)] italic py-2">
                    No comments yet. Be the first to leave feedback!
                  </p>
                ) : (
                  data.comments.map((c: PublicComment) => {
                    let relativeTime = 'recently'
                    try {
                      relativeTime = formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                      })
                    } catch {
                      relativeTime = ''
                    }

                    return (
                      <div
                        key={c.id}
                        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--color-text)]">{c.commenter_name}</span>
                          <span className="text-[11px] text-[var(--color-text-secondary)]">{relativeTime}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
                          {c.comment_text}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Listing Agent & Brokerage Card */}
          <div className="lg:col-span-4 space-y-6">
            {/* AGENT CONTACT CARD */}
            <div
              id="agent-contact-card"
              className="sticky top-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-6 space-y-5 shadow-xl"
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-gold)] block">
                Listing Representation
              </span>

              <div className="flex items-center gap-4">
                {data.agent.avatar_url ? (
                  <img
                    src={data.agent.avatar_url}
                    alt={data.agent.name}
                    className="size-16 rounded-full object-cover border-2 border-[var(--color-gold)]"
                  />
                ) : (
                  <div className="size-16 rounded-full bg-[var(--color-gold)]/10 border-2 border-[var(--color-gold)] text-[var(--color-gold)] font-bold text-xl flex items-center justify-center">
                    {data.agent.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)]">{data.agent.name}</h3>
                  <p className="text-xs text-[var(--color-gold)]">LocalPRO Realty Agent</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">DFW Metroplex Real Estate</p>
                </div>
              </div>

              {/* Agent Custom Brand Logo (if set) */}
              {data.agent.brand_logo_url ? (
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <img
                    src={data.agent.brand_logo_url}
                    alt={`${data.agent.name} Brand`}
                    className="max-h-12 w-auto object-contain mx-auto"
                  />
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                {data.agent.phone ? (
                  <a
                    href={`tel:${data.agent.phone}`}
                    className="w-full py-2.5 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-black font-semibold text-xs tracking-wider uppercase rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone className="size-3.5" />
                    Call {data.agent.phone}
                  </a>
                ) : null}

                {data.agent.email ? (
                  <a
                    href={`mailto:${data.agent.email}?subject=Inquiry regarding ${encodeURIComponent(
                      data.address_full,
                    )}`}
                    className="w-full py-2.5 px-4 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text)] border border-[var(--color-border)] font-semibold text-xs tracking-wider uppercase rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Mail className="size-3.5" />
                    Email Agent
                  </a>
                ) : null}
              </div>

              {/* Brokerage Compliance Card */}
              <div className="pt-4 border-t border-[var(--color-border)] space-y-2 text-[11px] text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <img src={lpLogo} alt="LocalPRO Logo" className="h-5 w-auto object-contain" />
                  <span className="font-semibold text-[var(--color-text)]">LocalPRO Realty</span>
                </div>
                <p>5801 Headquarters Dr Ste 775, Plano, TX 75024</p>
                <p>Licensed Brokerage in Texas • Equal Housing Opportunity</p>
                <a
                  href="https://localprorealty.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-gold)] hover:underline inline-flex items-center gap-1 mt-1"
                >
                  localprorealty.com <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 5. PHOTO GALLERY FULLSCREEN LIGHTBOX MODAL */}
      {lightboxIndex !== null && data.photos[lightboxIndex] ? (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 select-none touch-none"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Lightbox Header */}
          <div
            className="flex items-center justify-between text-white py-2"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-[#a0a0a0]">
              <span className="font-semibold text-white">Photo {lightboxIndex + 1}</span> of{' '}
              {data.photos.length}
            </div>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="p-2 rounded-full hover:bg-white/10 text-stone-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-6" />
            </button>
          </div>

          {/* Lightbox Main Image & Arrows */}
          <div
            className="relative flex-1 flex items-center justify-center max-w-5xl mx-auto w-full my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setLightboxIndex(
                  (prev) => (prev! - 1 + data.photos.length) % data.photos.length,
                )
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors z-10 cursor-pointer"
            >
              <ChevronLeft className="size-6" />
            </button>

            <img
              src={data.photos[lightboxIndex].url}
              alt={data.photos[lightboxIndex].caption || 'Listing Photo'}
              className="max-h-[80vh] max-w-full object-contain rounded select-none shadow-2xl pointer-events-none"
            />

            <button
              type="button"
              onClick={() => setLightboxIndex((prev) => (prev! + 1) % data.photos.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors z-10 cursor-pointer"
            >
              <ChevronRight className="size-6" />
            </button>
          </div>

          {/* Lightbox Caption & Thumbnails */}
          <div
            className="text-center max-w-2xl mx-auto py-2"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {data.photos[lightboxIndex].caption ? (
              <p className="text-sm text-stone-200 font-medium">
                {data.photos[lightboxIndex].caption}
              </p>
            ) : null}
            <p className="text-[11px] text-[#666] mt-1">
              <span className="hidden sm:inline">Use Left / Right arrow keys to navigate, Esc to close</span>
              <span className="sm:hidden">Swipe left / right to navigate • Swipe down or tap outside to close</span>
            </p>
          </div>
        </div>
      ) : null}

      {/* 6. FIXED BOTTOM BRANDED FOOTER */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] py-8 pb-28 lg:pb-8 text-center text-xs text-[var(--color-text-secondary)] mt-16">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p>© {new Date().getFullYear()} LocalPRO Realty. All rights reserved.</p>
          <p>5801 Headquarters Dr Ste 775, Plano, TX 75024 • Dallas-Fort Worth, Texas</p>
          <p className="text-[var(--color-text-secondary)]/80 text-[10px]">
            Information is deemed reliable but not guaranteed. Equal Housing Opportunity.
          </p>
        </div>
      </footer>

      {/* 7. MOBILE STICKY BOTTOM AGENT ACTION BAR (< lg only) */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md px-4 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.15)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.6)] pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Agent Mini Profile - Click to scroll to full card */}
          <button
            type="button"
            onClick={scrollToAgentCard}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
          >
            {data.agent.avatar_url ? (
              <img
                src={data.agent.avatar_url}
                alt={data.agent.name}
                className="size-9 rounded-full object-cover border border-[var(--color-gold)] shrink-0 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="size-9 rounded-full bg-[var(--color-gold)]/10 border border-[var(--color-gold)] text-[var(--color-gold)] font-bold text-xs flex items-center justify-center shrink-0">
                {data.agent.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--color-text)] truncate group-hover:text-[var(--color-gold)] transition-colors">
                {data.agent.name}
              </p>
              <p className="text-[10px] text-[var(--color-text-secondary)] truncate">Listing Agent</p>
            </div>
          </button>

          {/* Direct Contact CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            {data.agent.phone ? (
              <a
                href={`tel:${data.agent.phone}`}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-black font-semibold text-xs tracking-wider uppercase transition-colors shadow"
                title={`Call ${data.agent.phone}`}
              >
                <Phone className="size-3.5" />
                <span>Call</span>
              </a>
            ) : null}

            {data.agent.email ? (
              <a
                href={`mailto:${data.agent.email}?subject=Inquiry regarding ${encodeURIComponent(
                  data.address_full,
                )}`}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text)] border border-[var(--color-border)] font-semibold text-xs tracking-wider uppercase transition-colors shadow"
                title="Email Agent"
              >
                <Mail className="size-3.5" />
                <span>Email</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* 8. DIRECT FLOATING THEME TOGGLE (ON THE RIGHT) */}
      <div className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:right-6 lg:bottom-6 z-40">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="flex size-11 items-center justify-center rounded-full border border-[var(--color-gold-border)] bg-[var(--color-surface)] text-[var(--color-gold)] shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--color-gold)] hover:shadow-[0_0_16px_rgba(207,184,124,0.3)] active:scale-95 cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="size-5 text-[var(--color-gold)]" />
          ) : (
            <Moon className="size-5 text-[var(--color-gold)]" />
          )}
        </button>
      </div>
    </div>
  )
}
export default PublicListingSharePage
