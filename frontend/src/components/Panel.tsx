import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PanelProps {
  title: string
  /** a short line under the title */
  subtitle?: string
  /** a link in the corner, e.g. "View all" */
  action?: { to: string; label: string }
  /** anything else for the corner, e.g. a switch between a chart and its table */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** A titled white card, the building block of the dashboard. */
export function Panel({ title, subtitle, action, aside, className = '', children }: PanelProps) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {aside}
          {action && (
            <Link to={action.to} className="text-sm font-medium text-brand-700 hover:underline">
              {action.label} →
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}
