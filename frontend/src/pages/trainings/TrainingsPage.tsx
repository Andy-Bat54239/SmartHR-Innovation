import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { deleteTraining, listTrainings } from '../../api/trainings'
import type { Training } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadError, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { filterControl } from '../../lib/styles'
import { phaseTone, trainingDates, trainingPhase } from '../../lib/training'
import { useNewFromUrl } from '../../hooks/useNewFromUrl'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'
import { TrainingForm } from './TrainingForm'

export default function TrainingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  useDocumentTitle('Trainings')
  const trainings = useQuery({ queryKey: ['trainings', 'list'], queryFn: listTrainings })

  const openNew = useNewFromUrl()
  const [editing, setEditing] = useState<Training | 'new' | null>(openNew ? 'new' : null)
  const [deleting, setDeleting] = useState<Training | null>(null)
  const [search, setSearch] = useState('')

  const remove = useMutation({
    mutationFn: (training: Training) => deleteTraining(training.id),
    onSuccess: async (_data, training) => {
      await queryClient.invalidateQueries({ queryKey: ['trainings'] })
      toast(`Deleted ${training.title}`)
      setDeleting(null)
    },
  })

  // newest first; trainings with no date go to the bottom
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (trainings.data ?? [])
      .filter((t) => !term || t.title.toLowerCase().includes(term) || (t.trainer ?? '').toLowerCase().includes(term))
      .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '') || a.title.localeCompare(b.title))
  }, [trainings.data, search])

  function closeDelete() {
    setDeleting(null)
    remove.reset()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trainings</h1>
          <p className="text-sm text-slate-500">Courses and workshops. Open one to see who is enrolled and to enrol people.</p>
        </div>
        <Button onClick={() => setEditing('new')}>New training</Button>
      </div>

      {trainings.isPending && <Loading />}
      {trainings.isError && <LoadError message={errorMessage(trainings.error)} onRetry={() => trainings.refetch()} />}

      {trainings.isSuccess && (
        <>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or trainer"
            aria-label="Search trainings"
            className={`${filterControl} mb-4 block w-full max-w-xs`}
          />
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              {trainings.data.length === 0 ? 'No trainings yet.' : 'No training matches your search.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
                <caption className="sr-only">Trainings</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Title</th>
                    <th scope="col" className="px-4 py-3">Trainer</th>
                    <th scope="col" className="px-4 py-3">Dates</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((training) => {
                    const phase = trainingPhase(training)
                    return (
                      <tr key={training.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/trainings/${training.id}`} className="text-brand-700 hover:underline">
                            {training.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{training.trainer ?? <span className="text-slate-400">—</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{trainingDates(training)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={phaseTone[phase]}>{phase}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/trainings/${training.id}`}
                              className="inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50"
                            >
                              Enrolment
                            </Link>
                            <Button variant="secondary" className="px-2.5 py-1" onClick={() => setEditing(training)}>
                              Edit
                            </Button>
                            <Button variant="secondary" className="px-2.5 py-1 text-red-700" onClick={() => setDeleting(training)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'New training' : 'Edit training'} onClose={() => setEditing(null)}>
        <TrainingForm
          initial={editing === 'new' || editing === null ? undefined : editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete training"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onCancel={closeDelete}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        Delete <strong className="text-slate-900">{deleting?.title}</strong>? Everyone enrolled is removed from it first.
      </ConfirmDialog>
    </div>
  )
}
