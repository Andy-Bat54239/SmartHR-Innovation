import type { BadgeTone } from '../components/Badge'
import type { Training } from '../api/types'
import { formatDate, today } from './dates'

export type TrainingPhase = 'Upcoming' | 'Ongoing' | 'Completed' | 'Unscheduled'

/** Where a training stands today. ISO dates compare correctly as plain strings. */
export function trainingPhase(training: Pick<Training, 'startDate' | 'endDate'>, now = today()): TrainingPhase {
  if (!training.startDate && !training.endDate) return 'Unscheduled'
  if (training.startDate && training.startDate > now) return 'Upcoming'
  if (training.endDate && training.endDate < now) return 'Completed'
  return 'Ongoing'
}

export const phaseTone: Record<TrainingPhase, BadgeTone> = {
  Upcoming: 'brand',
  Ongoing: 'green',
  Completed: 'slate',
  Unscheduled: 'amber',
}

/** "1 Apr 2026 – 5 Apr 2026", "1 Apr 2026", or "—" when there are no dates. */
export function trainingDates(training: Pick<Training, 'startDate' | 'endDate'>): string {
  const { startDate, endDate } = training
  if (startDate && endDate && startDate !== endDate) return `${formatDate(startDate)} – ${formatDate(endDate)}`
  return formatDate(startDate ?? endDate)
}
