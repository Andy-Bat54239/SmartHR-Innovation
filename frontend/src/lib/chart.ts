import type { GroupCount } from '../api/types'

/**
 * The categorical colours, always taken in this order (blue, orange, aqua, yellow, magenta). The order is what keeps neighbours
 * apart for colour-blind readers: it was run through the palette validator (adjacent normal-vision difference >= 19, colour-blind
 * difference >= 9), so never reorder or add to it. More than five groups are folded into one grey "others" slice instead.
 * Three of the five are lighter than 3:1 against white, so every slice is also named in a legend with its number.
 */
export const CATEGORY_COLORS = ['var(--color-cat-1)', 'var(--color-cat-2)', 'var(--color-cat-3)', 'var(--color-cat-4)', 'var(--color-cat-5)']
/** grey: "everything else", reads as context rather than as one more category */
export const OTHERS_COLOR = 'var(--color-series-muted)'

export interface Slice {
  key: string
  label: string
  count: number
  color: string
  /** where clicking the slice's legend row goes (the filtered list); omitted for grouped slices */
  to?: string
  /** a longer explanation, for the grouped slice */
  detail?: string
}

/** Month "2026-05" as a date in that month (the 1st), without any time-zone shift. */
function monthStart(month: string): Date {
  const [year, number] = month.split('-').map(Number)
  return new Date(year, number - 1, 1)
}

export const monthShort = (month: string) => monthStart(month).toLocaleDateString('en-GB', { month: 'short' })
export const monthLong = (month: string) => monthStart(month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

/**
 * Headcount by department as at most six slices: the five biggest departments, each with its own colour, and one grey slice
 * for the rest (departments beyond the fifth, and people with no department).
 */
export function departmentSlices(groups: GroupCount[]): Slice[] {
  const named = groups.filter((group) => group.id !== null && group.count > 0)
  const unassigned = groups.find((group) => group.id === null)?.count ?? 0

  const slices: Slice[] = named.slice(0, CATEGORY_COLORS.length).map((group, index) => ({
    key: group.id!,
    label: group.name,
    count: group.count,
    color: CATEGORY_COLORS[index],
    to: `/employees?departmentId=${group.id}`,
  }))

  const rest = named.slice(CATEGORY_COLORS.length)
  const restCount = rest.reduce((sum, group) => sum + group.count, 0)
  if (restCount + unassigned > 0) {
    const parts = []
    if (rest.length > 0) parts.push(`${rest.length} more ${rest.length === 1 ? 'department' : 'departments'} (${restCount})`)
    if (unassigned > 0) parts.push(`${unassigned} with no department`)
    slices.push({
      key: 'others',
      label: rest.length === 0 ? 'No department' : unassigned === 0 ? 'Other departments' : 'Others',
      count: restCount + unassigned,
      color: OTHERS_COLOR,
      detail: parts.join(' and '),
    })
  }
  return slices
}
