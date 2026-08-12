import { BookOpen, Download, HelpCircle, Laptop } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'

interface ResourceItem {
  id: string
  title: string
  description: string
  icon: any
  type: string
}

const RESOURCES: ResourceItem[] = [
  { id: '1', title: 'Brand Guidelines', description: 'Brokerage logo pack, color codes, style guides, and font assets.', icon: Laptop, type: 'Design Pack' },
  { id: '2', title: 'Brokerage Guidelines', description: 'Policies, commission schedules, splits calculations, and transaction guides.', icon: BookOpen, type: 'Documentation' },
  { id: '3', title: 'Compliance Manual', description: 'Standard disclosure guidelines, listing requirements, and legal compliance.', icon: BookOpen, type: 'Regulatory' },
  { id: '4', title: 'Support & FAQs', description: 'Agent onboarding guide, platform usage documentation, and helpline contacts.', icon: HelpCircle, type: 'Reference' },
]

export default function AdminResourcesPage() {
  return (
    <AdminShell title="Resources" eyebrow="Brokerage Materials">
      <div className="space-y-6">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Brokerage manuals, compliance reference materials, marketing logopacks, and style sheets.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {RESOURCES.map((r) => {
            const Icon = r.icon
            return (
              <article
                key={r.id}
                className="rounded-md border border-[var(--color-border)] bg-[#1a1a1a] p-6 hover:border-[var(--color-gold-border)] transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-semibold text-[#CFB87C] uppercase tracking-wider">
                      {r.type}
                    </span>
                    <Icon className="size-5 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="text-base font-semibold text-white mt-4">{r.title}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                    {r.description}
                  </p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#CFB87C] hover:text-white uppercase tracking-wider"
                  >
                    <Download className="size-4" />
                    Access Files
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </AdminShell>
  )
}
