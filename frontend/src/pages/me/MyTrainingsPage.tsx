import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { listMyTrainings } from '../../api/me'
import type { Training } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { LoadError, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { daysBetween, formatDate, today } from '../../lib/dates'
import { phaseTone, trainingDates, trainingPhase } from '../../lib/training'

/** The trainings the signed-in person is enrolled in: read only. */
export default function MyTrainingsPage() {
  useDocumentTitle('My trainings')
  const { user } = useAuth()
  const linked = user?.employee != null
  const [viewing, setViewing] = useState<Training | null>(null)
  const trainings = useQuery({ queryKey: ['my', 'trainings'], queryFn: listMyTrainings, enabled: linked })

  if (!linked) {
    return <p className="py-10 text-sm text-slate-500">This account is not linked to an employee record, so it has no trainings of its own.</p>
  }

  const rows = [...(trainings.data ?? [])].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '') || a.title.localeCompare(b.title))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My trainings</h1>
        <p className="text-sm text-slate-500">The courses you are enrolled in. Select one to see its details. HR handles enrolment.</p>
      </div>

      {trainings.isPending && <Loading />}
      {trainings.isError && <LoadError message={errorMessage(trainings.error)} onRetry={() => trainings.refetch()} />}

      {trainings.isSuccess &&
        (rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
            You are not enrolled in any training.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">My trainings</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Title</th>
                  <th scope="col" className="px-4 py-3">Trainer</th>
                  <th scope="col" className="px-4 py-3">Dates</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((training) => (
                  <tr key={training.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <button type="button" onClick={() => setViewing(training)} className="text-left hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600">
                        {training.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{training.trainer ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{trainingDates(training)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={phaseTone[trainingPhase(training)]}>{trainingPhase(training)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" className="px-2.5 py-1" onClick={() => setViewing(training)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <Modal open={viewing !== null} title={viewing?.title ?? 'Training'} onClose={() => setViewing(null)}>
        {viewing && <TrainingDetails training={viewing} onClose={() => setViewing(null)} />}
      </Modal>
    </div>
  )
}

/** "Starts in 3 days", "Ends tomorrow", "Ended 2 days ago"... relative to today. */
function timing(training: Training): string | null {
  const phase = trainingPhase(training)
  const day = (iso: string) => Math.round(new Date(`${iso}T00:00:00`).getTime() / 86_400_000)
  const now = day(today())
  const plural = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
  if (phase === 'Upcoming' && training.startDate) {
    const n = day(training.startDate) - now
    return n === 1 ? 'Starts tomorrow' : `Starts in ${plural(n)}`
  }
  if (phase === 'Ongoing' && training.endDate) {
    const n = day(training.endDate) - now
    return n <= 0 ? 'Ends today' : n === 1 ? 'Ends tomorrow' : `Ends in ${plural(n)}`
  }
  if (phase === 'Completed' && training.endDate) {
    const n = now - day(training.endDate)
    return n === 1 ? 'Ended yesterday' : `Ended ${plural(n)} ago`
  }
  return null
}

function TrainingDetails({ training, onClose }: { training: Training; onClose: () => void }) {
  const phase = trainingPhase(training)
  const note = timing(training)
  const duration = training.startDate && training.endDate ? daysBetween(training.startDate, training.endDate) : null
  const rows: [string, string][] = [
    ['Trainer', training.trainer ?? '—'],
    ['Dates', trainingDates(training)],
    ['Duration', duration ? `${duration} ${duration === 1 ? 'day' : 'days'}` : '—'],
    ['Added on', formatDate(training.createdAt.slice(0, 10))],
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={phaseTone[phase]}>{phase}</Badge>
        {note && <span className="text-sm text-slate-600">{note}</span>}
      </div>

      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
        {rows.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-4 px-3 py-2">
            <dt className="text-slate-500">{term}</dt>
            <dd className="text-right font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">About this training</h3>
        <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">{training.description ?? 'No description has been added yet.'}</p>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
