/** Sunday-start week containing `date` (matches photography calendar UI). */
export function startOfWeek(date: Date): Date {
  const copy = new Date(date)
  const day = copy.getDay()
  copy.setDate(copy.getDate() - day)
  copy.setHours(12, 0, 0, 0)
  return copy
}
