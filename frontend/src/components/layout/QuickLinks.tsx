import { ExternalLink, FileText, Map, Palette } from 'lucide-react'

const LINKS = [
  { href: 'https://www.canva.com', label: 'Canva', icon: Palette },
  { href: 'https://www.dotloop.com', label: 'Dot Loop', icon: FileText },
  { href: 'https://www.ntreis.net', label: 'NTREIS', icon: Map },
] as const

export function QuickLinks() {
  return (
    <div className="space-y-3">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-gold)]"
        >
          <Icon className="size-4" aria-hidden />
          {label}
          <ExternalLink className="ml-auto size-3 opacity-60" aria-hidden />
        </a>
      ))}
    </div>
  )
}
