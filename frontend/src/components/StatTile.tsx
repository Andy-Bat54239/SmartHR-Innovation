import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const tints = {
  blue: 'bg-blue-50 text-blue-600',
  teal: 'bg-brand-50 text-brand-600',
  violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-600',
}

export interface Delta {
  /** change as a whole percent: 6 means "up 6%" */
  percent: number
  /** what it is compared with, for screen readers: "last month" */
  versus: string
  /** is more of this good news? true = green when up, false = green when down, null = neither (shown in grey) */
  upIsGood: boolean | null
}

function deltaTone(delta: Delta) {
  if (delta.upIsGood === null || delta.percent === 0) return 'text-slate-600'
  return (delta.percent > 0) === delta.upIsGood ? 'text-good' : 'text-red-700'
}

interface StatTileProps {
  /** what is counted: sentence case, no trailing colon */
  label: string
  value: number
  icon: LucideIcon
  tint: keyof typeof tints
  /** change against an earlier period; leave out when there is nothing to compare with */
  delta?: Delta
  /** one short line under the number */
  detail?: ReactNode
  /** makes the whole tile a link to the list behind the number */
  to?: string
}

/** One headline number. A bare number is not a chart, so it gets a tile, not a one-bar bar chart. */
export function StatTile({ label, value, icon: Icon, tint, delta, detail, to }: StatTileProps) {
  const body = (
    <div className="flex items-start gap-3.5">
      <span aria-hidden className={`inline-flex size-12 shrink-0 items-center justify-center rounded-full ${tints[tint]}`}>
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-3xl font-semibold tracking-tight text-slate-900">{value.toLocaleString('en')}</span>
          {delta && (
            <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${deltaTone(delta)}`}>
              {delta.percent !== 0 &&
                (delta.percent > 0 ? <ArrowUpRight aria-hidden className="size-4" strokeWidth={2.25} /> : <ArrowDownRight aria-hidden className="size-4" strokeWidth={2.25} />)}
              {delta.percent === 0 ? 'No change' : `${Math.abs(delta.percent)}%`}
              <span className="sr-only">
                {delta.percent > 0 ? ' more' : delta.percent < 0 ? ' fewer' : ''} than {delta.versus}
              </span>
            </span>
          )}
        </p>
        {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  )
  const box = 'block rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card'
  return to ? (
    <Link to={to} className={`${box} transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}
