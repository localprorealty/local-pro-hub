import { motion } from 'framer-motion'
import {
  Shield,
  ArrowLeft,
  Mail,
  Building2,
  Target,
  Users,
  Database,
  HardDrive,
  Radio,
  Share2,
  Lock,
  UserCheck,
  RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import lpMonogram from '@/assets/branding/LP_Gold.png'

const DATA_COLLECTION_ROWS = [
  {
    category: 'Login email and password (at sign-in only)',
    purpose:
      "Authenticates the agent against LocalPRO Hub's backend (Supabase Auth). Password is transmitted once over HTTPS and is never stored by the Extension in any form.",
  },
  {
    category: 'Authentication session token',
    purpose:
      "Used in the Authorization header of requests to LocalPRO Hub's backend, so the Extension can retrieve listing data on the agent's behalf.",
  },
  {
    category: 'Agent identity (name, role)',
    purpose:
      "Displayed in the Extension's popup so the agent can confirm they are logged in as themselves.",
  },
  {
    category: 'Active listing ID',
    purpose: "Identifies which listing's data to retrieve and fill into Matrix.",
  },
  {
    category:
      'Listing property details (address, list price, MLS number, property description, bedrooms, bathrooms, square footage, year built, parcel ID, agreement type)',
    purpose:
      'Filled directly into the corresponding NTREIS Matrix input fields to eliminate duplicate manual entry.',
  },
  {
    category:
      'Primary seller contact information (name, phone, email), if entered in LocalPRO Hub',
    purpose:
      'Filled into the corresponding Matrix seller/client fields, where required by the MLS submission form.',
  },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-black)] text-white py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-[var(--color-gold-dim)] selection:text-[var(--color-gold)]">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[var(--color-gold-dim)] blur-[120px] rounded-full opacity-40" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
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
          className="bg-[#0c0c0c]/90 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl p-6 sm:p-10 shadow-2xl space-y-10"
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
              Last updated: September 9, 2026
            </p>
          </div>

          {/* 1. Who We Are */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <Building2 className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>1. Who We Are</h2>
            </div>
            <div className="text-[15px] leading-relaxed text-[#cccccc] pl-7 space-y-2">
              <p>
                LocalPRO Hub Matrix Assistant (&ldquo;the Extension&rdquo;) is developed and operated
                by:
              </p>
              <div className="bg-[#141414] border border-[#222222] rounded-xl p-4 text-sm space-y-1 text-white">
                <p className="font-semibold text-base text-[var(--color-gold)]">LocalPRO Realty</p>
                <p className="text-[#cccccc]">5801 Headquarters Dr Ste 775, Plano, TX 75024</p>
                <p className="text-[#cccccc]">
                  Contact:{' '}
                  <a
                    href="mailto:tricia@localprorealty.com"
                    className="text-[var(--color-gold)] hover:underline font-medium"
                  >
                    tricia@localprorealty.com
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* 2. Single Purpose of This Extension */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <Target className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>2. Single Purpose of This Extension</h2>
            </div>
            <p className="text-[15px] leading-relaxed text-[#cccccc] pl-7">
              This Extension exists for exactly one purpose: to reduce duplicate manual data entry for
              LocalPRO Realty agents by automatically filling property listing fields into the NTREIS
              Matrix MLS input form, using data the agent has already entered into LocalPRO Hub. It is
              a professional productivity tool for authorized real estate agents and is used for no
              other purpose.
            </p>
          </section>

          {/* 3. Who Can Use This Extension */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <Users className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>3. Who Can Use This Extension</h2>
            </div>
            <p className="text-[15px] leading-relaxed text-[#cccccc] pl-7">
              This Extension is intended solely for use by licensed real estate professionals
              affiliated with LocalPRO Realty. It is not directed at, marketed to, or intended for use
              by children under the age of 13, and we do not knowingly collect data from children.
            </p>
          </section>

          {/* 4. Data We Collect and Why */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <Database className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>4. Data We Collect and Why</h2>
            </div>
            <div className="pl-7 space-y-4">
              <p className="text-[15px] leading-relaxed text-[#cccccc]">
                The Extension accesses the following categories of data, and no others:
              </p>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-[#222222] bg-[#141414]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#222222] bg-[#1a1a1a] text-xs uppercase tracking-wider text-[var(--color-gold)]">
                    <tr>
                      <th className="py-3 px-4 sm:px-6 font-semibold w-2/5">Data</th>
                      <th className="py-3 px-4 sm:px-6 font-semibold w-3/5">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222] text-[#cccccc]">
                    {DATA_COLLECTION_ROWS.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#181818]/60 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-medium text-white align-top">
                          {row.category}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 leading-relaxed align-top">
                          {row.purpose}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-[#141414] border border-[#222222] rounded-xl p-4 text-sm sm:text-[15px] text-[#cccccc] leading-relaxed">
                <p>
                  We do <strong className="text-white">not</strong> collect browsing history, data
                  from any website other than the active NTREIS Matrix MLS input page and LocalPRO
                  Hub&apos;s own backend, keystrokes, financial or payment information, or health
                  information.
                </p>
              </div>
            </div>
          </section>

          {/* 5. How Data Is Stored */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <HardDrive className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>5. How Data Is Stored</h2>
            </div>
            <div className="text-[15px] leading-relaxed text-[#cccccc] pl-7 space-y-3">
              <p>
                All session data (authentication token, agent identity, listing ID, listing data) is
                held only in <code className="text-[var(--color-gold)] bg-black/60 px-1.5 py-0.5 rounded border border-[#333333] text-xs font-mono">chrome.storage.session</code>, a temporary, in-memory storage area.
              </p>
              <p>
                This data is automatically and completely erased when the agent logs out, or when the
                Chrome browser process is closed.
              </p>
              <p>
                The Extension does not use <code className="text-[var(--color-gold)] bg-black/60 px-1.5 py-0.5 rounded border border-[#333333] text-xs font-mono">chrome.storage.local</code>, localStorage, sessionStorage, IndexedDB, or cookies to
                persist any personal or listing data. The only value stored in{' '}
                <code className="text-[var(--color-gold)] bg-black/60 px-1.5 py-0.5 rounded border border-[#333333] text-xs font-mono">chrome.storage.local</code> is a non-personal technical configuration string (the backend API base URL).
              </p>
              <p>
                No listing or personal data remains on the agent&apos;s device after the browser
                session ends or after the Extension is uninstalled.
              </p>
            </div>
          </section>

          {/* 6. How Data Is Transmitted */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <Radio className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>6. How Data Is Transmitted</h2>
            </div>
            <div className="text-[15px] leading-relaxed text-[#cccccc] pl-7 space-y-3">
              <p>
                All communication between the Extension and LocalPRO Hub&apos;s backend occurs over
                HTTPS with TLS encryption in transit.
              </p>
              <p>
                The Extension verifies that the requesting agent owns the listing being accessed before
                returning any data; requests for listings the agent does not own are rejected.
              </p>
              <p>
                Data flows in one direction only: from LocalPRO Hub to the Extension to the Matrix
                input form. The Extension never reads data from Matrix and sends it back to LocalPRO Hub
                or anywhere else.
              </p>
              <p>
                Filling of Matrix form fields happens entirely within the agent&apos;s own browser tab,
                via direct, page-local DOM manipulation. No listing or property data is transmitted to
                any third party, server, or service other than LocalPRO Hub&apos;s own backend and the
                NTREIS Matrix page the agent is actively using.
              </p>
            </div>
          </section>

          {/* 7. Data Sharing and Disclosure */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <Share2 className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>7. Data Sharing and Disclosure</h2>
            </div>
            <p className="text-[15px] leading-relaxed text-[#cccccc] pl-7">
              We do not sell, rent, lease, or share any data collected by this Extension with third
              parties, advertisers, or data brokers, for any purpose. This Extension contains no
              analytics libraries, advertising SDKs, tracking pixels, or third-party telemetry of any
              kind.
            </p>
          </section>

          {/* 8. Data Retention and Deletion */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <Lock className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>8. Data Retention and Deletion</h2>
            </div>
            <p className="text-[15px] leading-relaxed text-[#cccccc] pl-7">
              The Extension itself retains no data beyond the active browser session. All session data
              is cleared automatically on logout or browser close, as described in Section 5. Listing
              and agent data displayed by the Extension originates from LocalPRO Hub&apos;s own
              systems, which retain data according to LocalPRO Realty&apos;s internal business
              record-keeping practices, separate from this Extension.
            </p>
          </section>

          {/* 9. Your Rights and Controls */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <UserCheck className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>9. Your Rights and Controls</h2>
            </div>
            <p className="text-[15px] leading-relaxed text-[#cccccc] pl-7">
              Agents can end their Extension session and clear all locally held session data at any
              time by clicking &ldquo;Log Out&rdquo; in the Extension popup, or simply by closing their
              browser. Agents with questions about their data, or requests regarding their personal data
              held by LocalPRO Hub, may contact{' '}
              <a
                href="mailto:tricia@localprorealty.com"
                className="text-[var(--color-gold)] hover:underline font-medium"
              >
                tricia@localprorealty.com
              </a>
              .
            </p>
          </section>

          {/* 10. Changes to This Policy */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <RefreshCw className="w-5 h-5 text-[var(--color-gold)] shrink-0" />
              <h2>10. Changes to This Policy</h2>
            </div>
            <p className="text-[15px] leading-relaxed text-[#cccccc] pl-7">
              If this Extension&apos;s data practices change, this page will be updated to reflect those
              changes, and the &ldquo;Last updated&rdquo; date above will be revised accordingly.
            </p>
          </section>

          {/* 11. Contact Us */}
          <section className="mt-8 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--color-gold-dim)]/20 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 p-6 sm:p-8 rounded-b-2xl border-t">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                11. Contact Us
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Questions about this policy or the Extension&apos;s data practices can be directed to:
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
          <p>&copy; {new Date().getFullYear()} LocalPRO Realty. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}
