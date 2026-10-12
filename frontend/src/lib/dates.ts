/** yyyy-MM-dd in the user's own time zone, the format <input type="date"> and the API both use. */
export const today = () => new Date().toLocaleDateString('en-CA')

/** Dates arrive as "2026-03-01"; parsed as local midnight so the day never shifts with the time zone. */
const parse = (iso: string) => new Date(`${iso}T00:00:00`)

/** "1 Mar 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return parse(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "30 Sep 2026, 14:05:09": the moment as the person reading it sees it (their own time zone). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** Days from start to end, counting both (a one-day leave is 1). */
export function daysBetween(start: string, end: string): number {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86_400_000) + 1
}

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", then the date. */
export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(iso.slice(0, 10))
}

/** Did this moment (an ISO date-time) fall within the last `days` days? */
export function isWithinDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() <= days * 86_400_000
}

/** Working days (Monday to Friday) from start to end, both counted. Public holidays are not taken off. */
export function workingDays(start: string, end: string): number {
  let days = 0
  for (let day = parse(start); day <= parse(end); day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay()
    if (weekday !== 0 && weekday !== 6) days++
  }
  return days
}
