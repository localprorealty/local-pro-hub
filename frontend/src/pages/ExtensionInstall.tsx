import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  ExternalLink,
  FolderArchive,
  Layers,
  Settings,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

import { MissionShell } from '@/components/layout/MissionShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import type { Session } from '@supabase/supabase-js'
import type { UserProfile } from '@/lib/auth'
import lpMonogram from '@/assets/branding/LP_Gold.png'

const ChromeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="21.17" y1="8" x2="12" y2="8" />
    <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
    <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
  </svg>
)

type AuthState = {
  isLoading: boolean
  session: Session | null
  profile: UserProfile | null
}

type ExtensionInstallPageProps = {
  state: AuthState
}

function ExtensionInstallContent() {
  const webStoreUrl = (import.meta.env.VITE_CHROME_WEBSTORE_URL || '').trim()
  const [showManualSteps, setShowManualSteps] = useState(!webStoreUrl)

  const handleDownloadZip = () => {
    window.location.href = '/extension.zip'
  }

  const steps = [
    {
      icon: <Download className="size-5 text-[var(--color-primary)]" />,
      title: 'Download the Package',
      description: (
        <span>
          Click the{' '}
          <button
            onClick={handleDownloadZip}
            className="font-semibold text-[var(--color-primary)] underline hover:text-[var(--color-primary-hover)] bg-transparent border-none p-0 cursor-pointer"
          >
            Download Extension
          </button>{' '}
          button to download the `extension.zip` file to your computer.
        </span>
      ),
    },
    {
      icon: <FolderArchive className="size-5 text-[var(--color-primary)]" />,
      title: 'Extract/Unzip the File',
      description:
        'Locate the downloaded file and unzip/extract it to a folder on your computer (e.g. your Documents or Desktop).',
    },
    {
      icon: <ChromeIcon className="size-5 text-[var(--color-primary)]" />,
      title: 'Open Chrome Extensions',
      description: (
        <span>
          In Google Chrome, open a new tab and navigate to{' '}
          <strong className="text-white select-all">chrome://extensions</strong> by typing it in
          the address bar and pressing Enter.
        </span>
      ),
    },
    {
      icon: <Settings className="size-5 text-[var(--color-primary)]" />,
      title: 'Enable Developer Mode',
      description:
        'Turn on the "Developer Mode" toggle switch located in the top-right corner of the Extensions page.',
    },
    {
      icon: <Layers className="size-5 text-[var(--color-primary)]" />,
      title: 'Load the Extension',
      description:
        'Click the "Load unpacked" button in the top-left corner, and select the extracted folder containing the extension files.',
    },
    {
      icon: <CheckCircle className="size-5 text-[var(--color-success)]" />,
      title: 'Verify & Enable',
      description:
        'Confirm that the "LocalPRO Hub Helper" card appears in your extensions list and is turned on. You can now use it on MLS Matrix!',
    },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Intro Header */}
      <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-white)]">
              {webStoreUrl ? 'One-Click Installation' : 'Download LocalPRO Helper Extension'}
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Automate your MLS Matrix inputs directly. The LocalPRO Helper Extension syncs your
              active listings and fills form fields with a single click.
            </p>
          </div>

          <div className="shrink-0">
            {webStoreUrl ? (
              <Button
                onClick={() => window.open(webStoreUrl, '_blank', 'noopener,noreferrer')}
                className="h-11 bg-[var(--color-primary)] font-semibold text-[var(--color-black)] hover:bg-[var(--color-primary-hover)] px-6"
              >
                <ChromeIcon className="mr-2 size-5" />
                Add to Chrome
                <ExternalLink className="ml-1.5 size-3.5" />
              </Button>
            ) : (
              <Button
                onClick={handleDownloadZip}
                className="h-11 bg-[var(--color-primary)] font-semibold text-[var(--color-black)] hover:bg-[var(--color-primary-hover)] px-6"
              >
                <Download className="mr-2 size-5" />
                Download Extension (.zip)
              </Button>
            )}
          </div>
        </div>

        {webStoreUrl ? (
          <div className="mt-6 border-t border-[var(--color-border)] pt-4">
            <button
              onClick={() => setShowManualSteps(!showManualSteps)}
              className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] bg-transparent border-none p-0 cursor-pointer"
            >
              {showManualSteps ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              Manual developer mode installation instructions (Alternative)
            </button>
          </div>
        ) : (
          <p className="mt-4 text-[11px] text-[var(--color-text-secondary)]">
            * We are currently pending Chrome Web Store review. One-click installation from the store is coming soon.
          </p>
        )}
      </div>

      {/* Steps List */}
      {showManualSteps && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="space-y-1">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-white)] uppercase tracking-wider">
              Step-by-Step Manual Installation
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Follow these simple steps to load the unpacked extension in Developer Mode.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-primary-border)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#1a1a1a] border border-[var(--color-border)]">
                  {step.icon}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--color-white)]">
                    {idx + 1}. {step.title}
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default function ExtensionInstallPage({ state }: ExtensionInstallPageProps) {
  const isLoggedIn = !!(state.session && state.profile)
  const role = state.profile?.role

  const dashboardRole =
    role === 'marketing' || role === 'photographer' ? role : 'agent'

  if (isLoggedIn && role !== 'admin') {
    return (
      <MissionShell
        role={dashboardRole}
        title="Chrome Extension"
        subtitle="Install the helper extension to auto-fill Matrix listing inputs"
        email={state.session?.user?.email}
      >
        <ErrorBoundary title="Extension Install Page">
          <ExtensionInstallContent />
        </ErrorBoundary>
      </MissionShell>
    )
  }

  // Standalone public landing page layout
  return (
    <main className="min-h-svh w-full bg-[#0a0a0a] text-[var(--color-white)] px-6 py-12 flex flex-col justify-between">
      <div className="mx-auto w-full max-w-4xl space-y-12">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] pb-6">
          <div className="flex items-center gap-3">
            <img src={lpMonogram} alt="LocalPRO Logo" className="h-9 w-auto" />
            <span className="font-[family-name:var(--font-display)] text-md font-semibold tracking-wider text-[var(--color-white)]">
              LOCALPRO HUB
            </span>
          </div>
          {isLoggedIn ? (
            <Button
              onClick={() => (window.location.href = '/dashboard')}
              variant="outline"
              className="h-9 border-[var(--color-gold-border)] text-[var(--color-gold)] hover:bg-[var(--color-gold-dim)]"
            >
              Go to Dashboard
            </Button>
          ) : (
            <Button
              onClick={() => (window.location.href = '/login')}
              className="h-9 bg-[var(--color-primary)] font-semibold text-[var(--color-black)] hover:bg-[var(--color-primary-hover)]"
            >
              Log In
            </Button>
          )}
        </header>

        <ErrorBoundary title="Extension Install Content">
          <ExtensionInstallContent />
        </ErrorBoundary>
      </div>

      <footer className="mt-16 text-center text-[10px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-6">
        &copy; {new Date().getFullYear()} Local Pro Realty LLC. All rights reserved.
      </footer>
    </main>
  )
}
