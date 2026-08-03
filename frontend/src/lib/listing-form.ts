export type FieldRow = {
  key: string
  value: string
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function flattenFormData(
  data: Record<string, unknown> | null,
  prefix = '',
): FieldRow[] {
  if (!data) return []
  const rows: FieldRow[] = []

  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      rows.push(...flattenFormData(value as Record<string, unknown>, fullKey))
    } else {
      rows.push({ key: fullKey, value: normalizeValue(value) })
    }
  }

  return rows
}

function parseInputValue(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return value
}

function setNestedValue(
  target: Record<string, unknown>,
  dottedPath: string,
  value: unknown,
) {
  const segments = dottedPath.split('.')
  let cursor: Record<string, unknown> = target

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]
    if (i === segments.length - 1) {
      cursor[segment] = value
      return
    }
    const next = cursor[segment]
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  }
}

export function buildFormDataFromRows(rows: FieldRow[]): Record<string, unknown> | null {
  if (rows.length === 0) return null
  const output: Record<string, unknown> = {}
  rows.forEach((row) => {
    setNestedValue(output, row.key, parseInputValue(row.value))
  })
  return output
}
