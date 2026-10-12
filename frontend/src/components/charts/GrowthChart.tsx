import { useEffect, useRef, useState } from 'react'
import { monthLong, monthShort } from '../../lib/chart'

export interface MonthPoint {
  month: string
  total: number
}

const HEIGHT = 240
const MARGIN = { top: 22, right: 18, bottom: 30, left: 38 }
/** space between the plot's edge and the first / last point, so the dots are not cut off */
const INSET = 10
/** at most this many gridline steps above zero */
const MAX_STEPS = 5
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]

/** The width of an element, kept up to date as it changes (the chart redraws to fit its card). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

/** The smallest round step (1, 2, 5, 10, 20, 25, 50 ...) that reaches `max` within MAX_STEPS steps. */
function niceStep(max: number) {
  return STEPS.find((step) => Math.ceil(max / step) <= MAX_STEPS) ?? STEPS[STEPS.length - 1]
}

/**
 * How the headcount grew over the last months: one line from a zero baseline, a faint wash under it, a dot on every month and the
 * latest value written at the end. Hover (or Tab to a month) shows that month's number; the same numbers are in the table view.
 */
export function GrowthChart({ points }: { points: MonthPoint[] }) {
  const { ref, width } = useWidth()
  const [active, setActive] = useState<number | null>(null)

  const peak = Math.max(...points.map((point) => point.total), 0)
  const step = niceStep(peak)
  const top = Math.max(Math.ceil(peak / step) * step, step)
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => step * index)

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const x = (index: number) => MARGIN.left + INSET + (points.length === 1 ? 0 : (index / (points.length - 1)) * (plotWidth - 2 * INSET))
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point.total).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`
  const last = points.length - 1

  const shown = active === null ? null : points[active]

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`Employees by the end of each month, ${points.length} months. The latest total is ${points[last].total}.`}>
          {/* gridlines and the numbers they stand for */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#c3c2b7' : '#e1e0d9'} strokeWidth={1} />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
                {tick.toLocaleString('en')}
              </text>
            </g>
          ))}

          <path d={area} fill="var(--color-series)" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="var(--color-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* the crosshair follows the month that is being looked at */}
          {active !== null && <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />}

          {points.map((point, index) => (
            <g key={point.month}>
              <circle cx={x(index)} cy={y(point.total)} r={index === active ? 6 : 4.5} fill="var(--color-series)" stroke="#fff" strokeWidth={2} />
              <text x={x(index)} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {monthShort(point.month)}
              </text>
            </g>
          ))}

          {/* the latest value, written at the end of the line */}
          <text x={x(last)} y={y(points[last].total) - 12} textAnchor="end" className="fill-slate-900 text-xs font-semibold tabular-nums">
            {points[last].total.toLocaleString('en')}
          </text>

          {/* the hit areas are wider than the dots; each one can also be reached with Tab */}
          {points.map((point, index) => {
            const slot = plotWidth / points.length
            return (
              <rect
                key={point.month}
                x={x(index) - slot / 2}
                y={MARGIN.top}
                width={slot}
                height={plotHeight + MARGIN.bottom}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${monthLong(point.month)}: ${point.total} ${point.total === 1 ? 'employee' : 'employees'}`}
                onPointerEnter={() => setActive(index)}
                onPointerMove={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="outline-none focus-visible:stroke-brand-600 focus-visible:stroke-2"
              />
            )
          })}
        </svg>
      )}

      {shown && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: Math.min(Math.max(x(active), 60), Math.max(width - 60, 60)), top: Math.max(y(shown.total) - 62, 0) }}
        >
          <p className="font-semibold tabular-nums">
            {shown.total.toLocaleString('en')} {shown.total === 1 ? 'employee' : 'employees'}
          </p>
          <p className="text-slate-300">
            <span aria-hidden className="mr-1.5 inline-block h-0.5 w-3 rounded align-middle" style={{ background: 'var(--color-series)' }} />
            {monthLong(shown.month)}
            {active === last ? ' (so far)' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

/** The same numbers as a table, for anyone who would rather read them (or cannot see the line). */
export function GrowthTable({ points }: { points: MonthPoint[] }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Employees hired by the end of each month</caption>
      <thead className="text-left text-xs text-slate-500">
        <tr>
          <th scope="col" className="py-2 font-medium">
            Month
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Employees
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Joined that month
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {points.map((point, index) => {
          const joined = index === 0 ? null : point.total - points[index - 1].total
          return (
            <tr key={point.month}>
              <th scope="row" className="py-2 text-left font-normal text-slate-700">
                {monthLong(point.month)}
              </th>
              <td className="py-2 text-right font-medium text-slate-900 tabular-nums">{point.total.toLocaleString('en')}</td>
              <td className="py-2 text-right text-slate-600 tabular-nums">{joined === null ? '—' : joined > 0 ? `+${joined}` : joined}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
