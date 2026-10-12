import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Slice } from '../../lib/chart'

const SIZE = 200
const RADIUS = 72
const THICKNESS = 26
const GAP = 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface DonutChartProps {
  slices: Slice[]
  /** what one unit is called: "employee" */
  unit: string
  /** the word under the total in the middle */
  totalLabel: string
  /** names the list for screen readers */
  label: string
}

/**
 * A ring split into at most six slices, with the total in the middle and a legend that names every slice, its number and its share.
 * The legend is the table view too: every value in the ring is written there. Hover or focus a legend row to see its slice in the middle.
 */
export function DonutChart({ slices, unit, totalLabel, label }: DonutChartProps) {
  const [active, setActive] = useState<string | null>(null)
  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  const share = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0)
  const shown = slices.find((slice) => slice.key === active)

  // each slice starts where the ones before it end; a small gap of the card's colour separates neighbours
  const lengths = slices.map((slice) => (slice.count / total) * CIRCUMFERENCE)
  const arcs = slices.map((slice, index) => ({
    slice,
    length: slices.length > 1 ? Math.max(lengths[index] - GAP, 0.5) : lengths[index],
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }))

  return (
    // a container query: the ring sits beside its legend when the card is wide enough, above it when it is not
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @sm:flex-row @sm:gap-6">
        <div className="relative size-36 shrink-0 @md:size-44">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="size-full -rotate-90">
            {arcs.map(({ slice, length, offset }) => (
              <circle
                key={slice.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={slice.key === active ? THICKNESS + 6 : THICKNESS}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-offset}
                opacity={active === null || slice.key === active ? 1 : 0.45}
                onPointerEnter={() => setActive(slice.key)}
                onPointerLeave={() => setActive(null)}
                className="transition-[opacity,stroke-width]"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums @md:text-3xl">{(shown ? shown.count : total).toLocaleString('en')}</span>
            <span className="max-w-20 truncate text-xs text-slate-600 @md:max-w-24">{shown ? shown.label : totalLabel}</span>
          </div>
        </div>

        <ul aria-label={label} className="w-full min-w-0 flex-1 space-y-0.5">
          {slices.map((slice) => {
            const row = (
              <>
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="min-w-0 flex-1 text-sm leading-tight text-slate-700">{slice.label}</span>
                <span className="shrink-0 text-sm font-medium text-slate-900 tabular-nums">
                  {slice.count}
                  <span className="ml-1.5 font-normal text-slate-500">({share(slice.count)}%)</span>
                </span>
              </>
            )
            const title = `${slice.label}: ${slice.count} ${slice.count === 1 ? unit : `${unit}s`} (${share(slice.count)}%)${slice.detail ? `. ${slice.detail}` : ''}`
            const rowClass = `flex items-center gap-2.5 rounded-md px-2 py-1.5 ${active === slice.key ? 'bg-slate-100' : ''}`
            return (
              <li key={slice.key} title={title}>
                {slice.to ? (
                  <Link
                    to={slice.to}
                    onPointerEnter={() => setActive(slice.key)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(slice.key)}
                    onBlur={() => setActive(null)}
                    className={`${rowClass} hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600`}
                  >
                    {row}
                  </Link>
                ) : (
                  <div onPointerEnter={() => setActive(slice.key)} onPointerLeave={() => setActive(null)} className={rowClass}>
                    {row}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
