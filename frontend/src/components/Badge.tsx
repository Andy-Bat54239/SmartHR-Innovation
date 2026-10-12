import type { ReactNode } from 'react'

export type BadgeTone = 'green' | 'amber' | 'red' | 'slate' | 'brand'

const tones: Record<BadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700',
}

/** A small coloured label, for statuses and types. */
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>
}
