export const fieldInputClass =
  'h-10 rounded-lg border-[#333333] bg-[#111111] text-white focus-visible:border-[#CFB87C] focus-visible:ring-[#CFB87C]/50'

export const fieldLabelClass =
  'font-[family-name:var(--font-display)] text-[11px] tracking-wider text-[#888888] uppercase'

export function fieldBorderClass(required: boolean, value: unknown, isPreFilled = false): string {
  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  if (required && empty && !isPreFilled) {
    return 'border-red-500/70 focus-visible:border-red-500 focus-visible:ring-red-500/30'
  }
  return ''
}
