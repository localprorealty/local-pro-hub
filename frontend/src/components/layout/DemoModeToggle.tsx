import { useDemoMode } from '@/lib/demo-mode'

export function DemoModeToggle() {
  const { isDemoMode, toggleDemoMode } = useDemoMode()

  return (
    <button
      type="button"
      onClick={toggleDemoMode}
      title={
        isDemoMode
          ? 'Demo Mode Active — Click to turn off'
          : 'Click to enable Demo Mode for presentations'
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase transition-all select-none cursor-pointer ${
        isDemoMode
          ? 'border border-[var(--color-gold)] bg-[var(--color-gold-dim)] text-[var(--color-gold)] shadow-[0_0_10px_rgba(200,169,81,0.25)]'
          : 'border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] opacity-70 hover:opacity-100 hover:border-[var(--color-gold)]/40'
      }`}
      aria-pressed={isDemoMode}
      aria-label="Toggle Presentation Demo Mode"
    >
      <span
        className={`size-1.5 rounded-full transition-colors ${
          isDemoMode ? 'bg-[var(--color-gold)] animate-pulse' : 'bg-neutral-500'
        }`}
      />
      <span>Demo</span>
    </button>
  )
}
