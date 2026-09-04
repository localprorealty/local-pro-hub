import { motion } from 'framer-motion'
import { Shield, Lock, EyeOff, Database, ArrowLeft, Mail, CheckCircle2, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import lpMonogram from '@/assets/branding/LP_Gold.png'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-black)] text-white py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-[var(--color-gold-dim)] selection:text-[var(--color-gold)]">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[var(--color-gold-dim)] blur-[120px] rounded-full opacity-40" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-[var(--color-border)]">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to LocalPRO Hub</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <img src={lpMonogram} alt="LocalPRO Realty" className="h-6 w-auto object-contain" />
            <span className="text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
              LocalPRO Hub
            </span>
          </div>
        </div>

        {/* Content Card */}
        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-[#0c0c0c]/90 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl p-6 sm:p-10 shadow-2xl space-y-8"
        >
          {/* Header Title Section */}
          <div className="space-y-3 pb-6 border-b border-[var(--color-border)]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-gold-dim)] border border-[var(--color-gold-border)] text-[var(--color-gold)] text-xs font-semibold tracking-widest uppercase">
              <Shield className="w-3.5 h-3.5" />
              Privacy Policy
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-[var(--font-display)]">
              Privacy Policy — LocalPRO Hub Matrix Assistant
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] font-mono">
              Last updated: September 4, 2026
            </p>
          </div>

          {/* Introductory Summary */}
          <section className="text-[15px] sm:text-base leading-relaxed text-[#cccccc] space-y-4">
            <p>
              This Chrome extension is built for LocalPRO Realty agents to reduce duplicate data entry between{' '}
              <strong className="text-white font-semibold">LocalPRO Hub</strong> and the{' '}
              <strong className="text-white font-semibold">NTREIS Matrix MLS</strong> system.
            </p>
          </section>

          {/* Section: What data this extension accesses */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <Database className="w-5 h-5 text-[var(--color-gold)]" />
              <h2>What data this extension accesses:</h2>
            </div>
            <div className="bg-[#141414] border border-[#222222] rounded-xl p-5 space-y-3.5 text-sm sm:text-[15px] text-[#cccccc]">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--color-gold)] shrink-0 mt-0.5" />
                <p>
                  <strong className="text-white">Your LocalPRO Hub login session:</strong> Used solely to authenticate you and retrieve the listing data you've already entered in the Hub.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--color-gold)] shrink-0 mt-0.5" />
                <p>
                  <strong className="text-white">The active listing's property details:</strong> Property information (address, property type, square footage, and similar fields), used solely to fill in the corresponding fields on the NTREIS Matrix input form.
                </p>
              </div>
            </div>
          </section>

          {/* Section: What this extension does not do */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <EyeOff className="w-5 h-5 text-[var(--color-gold)]" />
              <h2>What this extension does not do:</h2>
            </div>
            <div className="bg-[#141414] border border-[#222222] rounded-xl p-5 space-y-3.5 text-sm sm:text-[15px] text-[#cccccc]">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p>
                  It does <strong className="text-white">not</strong> access, read, or transmit any data from websites other than <code className="text-[var(--color-gold)] bg-black/50 px-1.5 py-0.5 rounded border border-[#333333] text-xs font-mono">ntrdd.mlsmatrix.com</code> and LocalPRO's own backend.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p>
                  It does <strong className="text-white">not</strong> sell, share, or transmit your data to any third party.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p>
                  It does <strong className="text-white">not</strong> store your login credentials — your session is held only temporarily (<code className="text-[var(--color-gold)] bg-black/50 px-1.5 py-0.5 rounded border border-[#333333] text-xs font-mono">chrome.storage.session</code>) and is automatically cleared when you close your browser.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p>
                  It does <strong className="text-white">not</strong> execute any remote code.
                </p>
              </div>
            </div>
          </section>

          {/* Section: Data retention */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-white">
              <Lock className="w-5 h-5 text-[var(--color-gold)]" />
              <h2>Data Retention</h2>
            </div>
            <p className="text-sm sm:text-[15px] leading-relaxed text-[#cccccc] pl-7">
              No listing or session data is retained by the extension itself once your browser session ends. Data displayed by the extension is sourced from LocalPRO Hub's own systems, which are subject to LocalPRO Realty's internal data practices.
            </p>
          </section>

          {/* Section: Changes to this policy */}
          <section className="space-y-3 pt-2">
            <h2 className="text-base sm:text-lg font-semibold text-white pl-7">
              Changes to this policy
            </h2>
            <p className="text-sm sm:text-[15px] leading-relaxed text-[#cccccc] pl-7">
              If this extension's data practices change, this page will be updated accordingly.
            </p>
          </section>

          {/* Section: Contact */}
          <section className="mt-8 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--color-gold-dim)]/20 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 p-6 sm:p-8 rounded-b-2xl border-t">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Questions or Contact
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Questions about this policy or the extension can be directed to:
              </p>
            </div>
            <a
              href="mailto:tricia@localprorealty.com"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-gold)] text-black font-semibold text-sm hover:bg-[var(--color-gold-hover)] transition-colors shadow-md shrink-0"
            >
              <Mail className="w-4 h-4" />
              <span>tricia@localprorealty.com</span>
            </a>
          </section>
        </motion.main>

        {/* Footer info */}
        <footer className="mt-8 text-center text-xs text-[var(--color-text-secondary)]">
          <p>© {new Date().getFullYear()} LocalPRO Realty. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}
