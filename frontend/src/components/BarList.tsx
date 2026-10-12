import { Link } from 'react-router-dom'

export interface BarItem {
  key: string
  label: string
  count: number
  /** where clicking the row goes (the filtered list); omit for rows that cannot be filtered */
  to?: string
  /** the "not assigned" row: drawn in grey so it reads as context, not as one more category */
  muted?: boolean
}

interface BarListProps {
  items: BarItem[]
  /** what one unit is called, for the tooltip: "employee" */
  unit: string
  /** the whole the shares are taken of (all employees) */
  total: number
}

/** Bars are scaled to 85% of the row so the value written after the tip always has room. */
const LONGEST_BAR_PERCENT = 85

/**
 * A horizontal bar chart made of a list: one series, one hue, every bar from the same zero baseline,
 * thin bars with the rounding only at the data end, and the value written at the tip in normal text colour.
 * Because it is a list of labelled numbers, it is its own table view for screen readers.
 */
export function BarList({ items, unit, total }: BarListProps) {
  const longest = Math.max(1, ...items.map((item) => item.count))

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const share = total > 0 ? Math.round((item.count / total) * 100) : 0
        const tooltip = `${item.label}: ${item.count} ${unit}${item.count === 1 ? '' : 's'} (${share}%)`
        const row = (
          <>
            <span className="truncate text-sm text-slate-700">{item.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={`h-4 shrink-0 rounded-r-[4px] ${item.muted ? 'bg-series-muted' : 'bg-series'}`}
                style={{ width: `${(item.count / longest) * LONGEST_BAR_PERCENT}%` }}
              />
              <span className="text-sm font-medium text-slate-900 tabular-nums">{item.count}</span>
            </span>
          </>
        )
        const layout = 'grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 rounded-md px-2 py-1.5 sm:grid-cols-[11rem_minmax(0,1fr)]'
        return (
          <li key={item.key}>
            {item.to ? (
              <Link to={item.to} title={tooltip} className={`${layout} hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600`}>
                {row}
              </Link>
            ) : (
              <div title={tooltip} className={layout}>
                {row}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
