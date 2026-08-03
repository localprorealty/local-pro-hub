import { useCallback, useRef, useState } from 'react'
import { Loader2, Mic, Search, Upload } from 'lucide-react'
import { motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import {
  parsePropertySearchQuery,
  searchRetsProperty,
  uploadPropertyPdf,
  type RetsPropertyMatch,
} from '@/lib/rets'
import { cn } from '@/lib/utils'

type PropertySearchStepProps = {
  onFound: (
    formFields: Record<string, unknown>,
    address: Record<string, string>,
    preFilledKeys: string[],
  ) => void
  onSkip: () => void
  isSubmitting?: boolean
}

function formatMatchLabel(match: RetsPropertyMatch): string {
  const p = match.property
  const street = [p.street_number, p.street_name, p.street_type]
    .filter(Boolean)
    .join(' ')
  const city = p.city ?? ''
  const mls = p.mls_number ?? match.raw.ListingId ?? ''
  const line = [street, city].filter(Boolean).join(', ')
  return mls ? `${line} · MLS ${mls}` : line || match.label
}

export function PropertySearchStep({
  onFound,
  onSkip,
  isSubmitting = false,
}: PropertySearchStepProps) {
  const [activeTab, setActiveTab] = useState<'ntreis' | 'pdf'>('ntreis')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [matches, setMatches] = useState<RetsPropertyMatch[] | null>(null)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    
    setUploading(true)
    setError(null)
    setNotFound(false)
    setMatches(null)
    
    try {
      const data = await uploadPropertyPdf(file)
      if (data.found && data.property) {
        const combined = { ...data.property, ...(data.address ?? {}) }
        const address = data.address ?? {}
        const preFilledKeys = Object.keys(combined)
        onFound(combined, address, preFilledKeys)
      } else {
        setError('Could not extract property details from PDF.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to parse PDF.')
    } finally {
      setUploading(false)
    }
  }

  const applyMatch = (match: RetsPropertyMatch) => {
    const combined = { ...match.property }
    const address: Record<string, string> = {}
    const addressKeys = [
      'street_number',
      'street_name',
      'street_type',
      'city',
      'state',
      'zip_code',
      'county',
      'subdivision',
      'mls_number',
    ] as const

    for (const key of addressKeys) {
      const val = combined[key]
      if (typeof val === 'string' && val.trim()) {
        address[key] = val.trim()
        delete combined[key]
      }
    }

    const preFilledKeys = Object.keys({ ...combined, ...address })
    onFound(combined, address, preFilledKeys)
    setMatches(null)
    setError(null)
    setNotFound(false)
  }

  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setNotFound(false)
    setMatches(null)

    const body = parsePropertySearchQuery(query)

    if (body.query_type === 'address' && !body.street_number) {
      setError(
        'Include a street number (e.g. 13128 Northhaven Way, Aubrey) or enter an MLS number.',
      )
      setLoading(false)
      return
    }

    try {
      const data = await searchRetsProperty(body)

      if (data.multiple && data.multiple.length > 0) {
        setMatches(data.multiple)
        return
      }

      if (data.found && data.property) {
        const combined = { ...data.property, ...(data.address ?? {}) }
        const address = data.address ?? {}
        const preFilledKeys = Object.keys(combined)
        onFound(combined, address, preFilledKeys)
        return
      }

      setNotFound(true)
      setError('Property not found in NTREIS.')
    } catch (err) {
      setNotFound(true)
      if (err instanceof ApiError && err.status === 503) {
        setError('NTREIS search is not configured on the server yet.')
      } else {
        setError('Could not reach NTREIS. You can still fill the form manually.')
      }
    } finally {
      setLoading(false)
    }
  }, [query, onFound])

  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser.')
      return
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => {
      setListening(false)
      setError('Could not capture voice. Try typing instead.')
    }
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) setQuery(transcript)
    }

    recognition.start()
  }

  return (
    <div className="flex min-h-[calc(100svh-4.5rem)] flex-col items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl text-center"
      >
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white md:text-5xl">
          Find the property
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-[#888888]">
          Enter details to pull property characteristics automatically.
        </p>

        {/* Tab Switcher */}
        <div className="mx-auto mt-8 flex max-w-xs justify-center rounded-full bg-[#111111] p-1 border border-[#222222]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ntreis')
              setError(null)
            }}
            className={cn(
              'flex-1 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200',
              activeTab === 'ntreis'
                ? 'bg-[#CFB87C] text-black shadow-lg'
                : 'text-[#888888] hover:text-white',
            )}
          >
            NTREIS Search
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('pdf')
              setError(null)
            }}
            className={cn(
              'flex-1 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200',
              activeTab === 'pdf'
                ? 'bg-[#CFB87C] text-black shadow-lg'
                : 'text-[#888888] hover:text-white',
            )}
          >
            Upload Tax PDF
          </button>
        </div>

        {activeTab === 'ntreis' ? (
          <>
            <div className="relative mx-auto mt-10 max-w-xl">
              <Label htmlFor="property-search" className="sr-only">
                Address or MLS number
              </Label>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border bg-[#0a0a0a] px-2 py-2 pl-5 transition-colors',
                  'border-[#CFB87C]/60 focus-within:border-[#CFB87C]',
                )}
              >
                <Input
                  id="property-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch()
                  }}
                  disabled={loading || isSubmitting}
                  placeholder="123 Main Street, Frisco TX  or  MLS# 20439821"
                  className="h-11 flex-1 border-0 bg-transparent text-base text-white shadow-none placeholder:text-[#555555] focus-visible:ring-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleVoiceInput}
                  disabled={loading || isSubmitting}
                  aria-label={listening ? 'Stop listening' : 'Speak address or MLS number'}
                  className={cn(
                    'size-11 shrink-0 rounded-full',
                    listening
                      ? 'bg-[#CFB87C] text-black hover:bg-[#CFB87C]/90'
                      : 'text-[#CFB87C] hover:bg-[#CFB87C]/10',
                  )}
                >
                  <Mic className="size-5" />
                </Button>
                <Button
                  type="button"
                  onClick={() => void runSearch()}
                  disabled={loading || isSubmitting || !query.trim()}
                  className="size-11 shrink-0 rounded-full bg-[#CFB87C] text-black hover:bg-[#CFB87C]/90"
                  aria-label="Search NTREIS"
                >
                  {loading || isSubmitting ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Search className="size-5" />
                  )}
                </Button>
              </div>
            </div>

            <p className="mt-5 text-sm text-[#666666]">
              We&apos;ll pull all property details from NTREIS automatically.
            </p>
          </>
        ) : (
          <div className="mx-auto mt-10 max-w-xl">
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-[#0a0a0a] p-8 text-center transition-colors',
                'border-[#333333] hover:border-[#CFB87C]/50',
                uploading && 'opacity-65 border-[#CFB87C]/30'
              )}
            >
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={uploading || isSubmitting}
                className="hidden"
              />
              <label
                htmlFor="pdf-upload"
                className={cn(
                  'flex flex-col items-center justify-center gap-4 cursor-pointer w-full h-full',
                  (uploading || isSubmitting) && 'pointer-events-none'
                )}
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-[#111111] border border-[#222222] text-[#CFB87C]">
                  {uploading ? (
                    <Loader2 className="size-7 animate-spin" />
                  ) : (
                    <Upload className="size-7" />
                  )}
                </div>
                <div>
                  <p className="text-base font-semibold text-white">
                    {uploading ? 'Parsing report...' : 'Upload Realist Tax PDF'}
                  </p>
                  <p className="mt-1 text-xs text-[#888888]">
                    {uploading ? 'Extracting property details using AI...' : 'Drag and drop or click to browse'}
                  </p>
                </div>
              </label>
            </div>
            
            <p className="mt-5 text-sm text-[#666666]">
              Download the property details PDF from Realist, upload it here, and we&apos;ll auto-fill the entire form.
            </p>
          </div>
        )}

        {matches && matches.length > 0 ? (
          <div className="mx-auto mt-8 max-w-xl text-left">
            <p className="mb-3 text-sm text-[#888888]">Multiple matches — select one:</p>
            <ul className="space-y-2">
              {matches.map((match) => (
                <li key={match.raw.ListingId ?? match.label}>
                  <button
                    type="button"
                    onClick={() => applyMatch(match)}
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-[#333333] bg-[#111111] px-4 py-3 text-left text-sm text-white transition-colors hover:border-[#CFB87C]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB87C]"
                  >
                    {formatMatchLabel(match)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {notFound ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-[#888888]">
              Property not in MLS yet. Let&apos;s fill it together.
            </p>
            <Button
              type="button"
              onClick={onSkip}
              disabled={isSubmitting}
              className="h-11 rounded-lg bg-[#CFB87C] px-8 font-[family-name:var(--font-display)] text-sm font-bold text-black hover:bg-[#CFB87C]/90"
            >
              Open the form →
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSkip}
            disabled={isSubmitting}
            className="mt-10 text-sm text-[#666666] underline-offset-4 hover:text-[#CFB87C] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB87C]"
          >
            Skip search — fill manually
          </button>
        )}

        <div className="mt-16 space-y-1 text-left font-mono text-[10px] tracking-wider text-[#333333] md:text-center">
          <p>SYSTEM: LOCALPRO HUB</p>
          <p>DATABASE: NTREIS REAL-TIME SYNC</p>
          <p>AUTH: AGENT_VERIFIED_SECURE</p>
        </div>
      </motion.div>
    </div>
  )
}
