import { FileText, Download, Search, Eye, Plus, Trash2, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { MissionShell } from '@/components/layout/MissionShell'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/users'

interface TemplateItem {
  id: string
  name: string
  category: string
  format: string
  updatedAt: string
  size: string
}

const INITIAL_TEMPLATES: TemplateItem[] = [
  { id: '1', name: 'Information About Brokerage Services (IABS)', category: 'Disclosures', format: 'PDF', updatedAt: '2026-08-01', size: '142 KB' },
  { id: '2', name: 'Exclusive Right to Sell Listing Agreement', category: 'Listing Contracts', format: 'PDF', updatedAt: '2026-07-15', size: '284 KB' },
  { id: '3', name: 'One to Four Family Residential Contract (Resale)', category: 'Sales Contracts', format: 'PDF', updatedAt: '2026-07-28', size: '512 KB' },
  { id: '4', name: 'Seller\'s Temporary Residential Lease', category: 'Leases', format: 'PDF', updatedAt: '2026-05-12', size: '118 KB' },
  { id: '5', name: 'Residential Real Estate Listing Agreement (Lease)', category: 'Listing Contracts', format: 'PDF', updatedAt: '2026-06-20', size: '195 KB' },
]

export default function AdminTemplatesPage() {
  const [search, setSearch] = useState('')
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [userRole, setUserRole] = useState<'agent' | 'admin'>('agent')
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: 'Disclosures',
    format: 'PDF',
    size: '150 KB',
  })

  // Load user role and templates
  useEffect(() => {
    let isMounted = true

    const loadSessionAndData = async () => {
      try {
        const {
          data: { session },
        } = await getSupabaseClient().auth.getSession()
        if (!isMounted) return

        const userId = session?.user?.id
        if (userId) {
          const profile = await fetchUserProfile(userId)
          if (isMounted && profile) {
            setUserRole(profile.role === 'admin' ? 'admin' : 'agent')
          }
        }
      } catch (err) {
        console.error('Failed to load user profile for templates view:', err)
      }
    }

    void loadSessionAndData()

    const stored = localStorage.getItem('localpro_brokerage_templates')
    if (stored) {
      try {
        setTemplates(JSON.parse(stored))
      } catch {
        setTemplates(INITIAL_TEMPLATES)
      }
    } else {
      setTemplates(INITIAL_TEMPLATES)
      localStorage.setItem('localpro_brokerage_templates', JSON.stringify(INITIAL_TEMPLATES))
    }

    return () => {
      isMounted = false
    }
  }, [])

  // Save to local storage helper
  const saveTemplates = (updatedList: TemplateItem[]) => {
    setTemplates(updatedList)
    localStorage.setItem('localpro_brokerage_templates', JSON.stringify(updatedList))
  }

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTemplate.name.trim()) return

    const template: TemplateItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: newTemplate.name.trim(),
      category: newTemplate.category,
      format: newTemplate.format,
      updatedAt: new Date().toISOString().split('T')[0],
      size: newTemplate.size || '100 KB',
    }

    const updated = [template, ...templates]
    saveTemplates(updated)
    setNewTemplate({
      name: '',
      category: 'Disclosures',
      format: 'PDF',
      size: '150 KB',
    })
    setIsAddModalOpen(false)
  }

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      const updated = templates.filter((t) => t.id !== id)
      saveTemplates(updated)
    }
  }

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  )

  const isAdmin = userRole === 'admin'

  const templatesContent = (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Access and manage standard legal documents and listing checklists used across the brokerage.
        </p>
        {isAdmin && (
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[var(--color-gold)] font-bold tracking-wider text-[var(--color-black)] hover:bg-[#dcc487] uppercase text-xs h-10 px-4 flex items-center gap-1.5 shrink-0 rounded-sm"
          >
            <Plus className="size-4" />
            Add Template
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <label className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="h-10 rounded-sm border-0 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] pr-3 pl-10 text-[var(--color-white)] focus-visible:ring-0"
          />
        </label>
      </div>

      <div className="rounded-md border border-[var(--color-border)] bg-[#111111] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-white">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50 text-[10px] font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                <th className="px-6 py-4">Template Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Format</th>
                <th className="px-6 py-4">Last Updated</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/40">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-[var(--color-surface-2)]/20 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <FileText className="size-4 text-[var(--color-gold)]" />
                    {t.name}
                  </td>
                  <td className="px-6 py-4 text-[var(--color-text-secondary)]">{t.category}</td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-[#2a2a2a] px-1.5 py-0.5 text-xs text-[#CFB87C]">
                      {t.format}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[var(--color-text-secondary)]">{t.updatedAt}</td>
                  <td className="px-6 py-4 text-[var(--color-text-secondary)]">{t.size}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {t.format === 'PDF' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[var(--color-text-secondary)] hover:text-white h-8 px-2.5"
                          onClick={() => {
                            window.open('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '_blank')
                          }}
                        >
                          <Eye className="mr-1 size-3.5" />
                          View
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--color-gold)] hover:text-white h-8 px-2.5"
                      >
                        <Download className="mr-1 size-3.5" />
                        Download
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 px-2.5"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--color-text-secondary)]">
                    No templates match your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Template Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-white"
            >
              <X className="size-5" />
            </button>

            <h3 className="font-semibold text-lg text-white mb-2">Add New Template</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-6">
              Create a document template placeholder. You can link this template to brokerage transactions.
            </p>

            <form onSubmit={handleAddTemplate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                  Template Name
                </label>
                <Input
                  required
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="e.g. Lead Paint Disclosure Form"
                  className="h-10 rounded-sm border-0 border-b border-[var(--color-border)] bg-[var(--color-surface-3)] text-white focus-visible:ring-0 focus-visible:border-[var(--color-gold)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    Category
                  </label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-sm border-0 border-b border-[var(--color-border)] bg-[var(--color-surface-3)] text-white text-sm focus:ring-0 focus:border-[var(--color-gold)] outline-none"
                  >
                    <option value="Disclosures">Disclosures</option>
                    <option value="Listing Contracts">Listing Contracts</option>
                    <option value="Sales Contracts">Sales Contracts</option>
                    <option value="Leases">Leases</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    Format
                  </label>
                  <select
                    value={newTemplate.format}
                    onChange={(e) => setNewTemplate({ ...newTemplate, format: e.target.value })}
                    className="w-full h-10 px-3 rounded-sm border-0 border-b border-[var(--color-border)] bg-[var(--color-surface-3)] text-white text-sm focus:ring-0 focus:border-[var(--color-gold)] outline-none"
                  >
                    <option value="PDF">PDF</option>
                    <option value="DOCX">DOCX</option>
                    <option value="ZIP">ZIP</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                  Mock Size
                </label>
                <Input
                  required
                  value={newTemplate.size}
                  onChange={(e) => setNewTemplate({ ...newTemplate, size: e.target.value })}
                  placeholder="e.g. 150 KB"
                  className="h-10 rounded-sm border-0 border-b border-[var(--color-border)] bg-[var(--color-surface-3)] text-white focus-visible:ring-0 focus-visible:border-[var(--color-gold)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]/40 mt-6">
                <Button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-transparent border border-[var(--color-border)] hover:bg-[#222] text-white h-10 px-4 rounded-sm text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[var(--color-gold)] font-bold text-[var(--color-black)] hover:bg-[#dcc487] uppercase text-xs h-10 px-4 rounded-sm"
                >
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  if (isAdmin) {
    return (
      <AdminShell title="Templates" eyebrow="Brokerage Files">
        {templatesContent}
      </AdminShell>
    )
  }

  return (
    <MissionShell role="agent" title="Templates" subtitle="Brokerage Files">
      {templatesContent}
    </MissionShell>
  )
}
