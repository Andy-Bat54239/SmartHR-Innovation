import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { listAllEmployees } from '../../api/employees'
import { deleteTraining, enrolEmployee, getTraining, listEnrolled, removeEmployee } from '../../api/trainings'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorMessage, LoadError, Loading } from '../../components/Feedback'
import { SelectField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { phaseTone, trainingDates, trainingPhase } from '../../lib/training'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'
import { TrainingForm } from './TrainingForm'

/** One training: its details, who is enrolled, and a way to enrol or remove people. */
export default function TrainingDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const training = useQuery({ queryKey: ['trainings', 'detail', id], queryFn: () => getTraining(id) })
  useDocumentTitle(training.data?.title ?? 'Training')
  const enrolled = useQuery({ queryKey: ['trainings', 'enrolled', id], queryFn: () => listEnrolled(id) })
  const employees = useQuery({ queryKey: ['employees', 'all'], queryFn: listAllEmployees })

  const [chosen, setChosen] = useState('')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['trainings'] })
  const nameOf = (employeeId: string) => {
    const e = employees.data?.find((x) => x.id === employeeId)
    return e ? `${e.firstName} ${e.lastName}` : 'Employee'
  }

  const enrol = useMutation({
    mutationFn: (employeeId: string) => enrolEmployee(id, employeeId),
    onSuccess: async (_data, employeeId) => {
      setChosen('')
      await refresh()
      toast(`Enrolled ${nameOf(employeeId)}`)
    },
    // e.g. somebody else enrolled them a moment ago: reload so the lists show the truth
    onError: () => void refresh(),
  })

  const unenrol = useMutation({
    mutationFn: (employeeId: string) => removeEmployee(id, employeeId),
    onSuccess: (_data, employeeId) => toast(`Removed ${nameOf(employeeId)}`),
    onSettled: () => void refresh(),
  })

  const remove = useMutation({
    mutationFn: () => deleteTraining(id),
    onSuccess: async () => {
      await refresh()
      toast('Training deleted')
      navigate('/trainings')
    },
  })

  // people who can still be enrolled: everyone except those already in
  const candidates = useMemo(() => {
    const taken = new Set((enrolled.data ?? []).map((e) => e.id))
    return [...(employees.data ?? [])]
      .filter((e) => !taken.has(e.id))
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
      .map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))
  }, [employees.data, enrolled.data])

  const people = useMemo(
    () => [...(enrolled.data ?? [])].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),
    [enrolled.data],
  )

  if (training.isPending) return <Loading />
  if (training.isError) {
    return (
      <div>
        <LoadError message={errorMessage(training.error)} onRetry={() => training.refetch()} />
        <Link to="/trainings" className="text-sm text-brand-600 hover:underline">
          Back to all trainings
        </Link>
      </div>
    )
  }

  const t = training.data
  const phase = trainingPhase(t)
  const actionError = enrol.error ?? unenrol.error

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-slate-500">
        <Link to="/trainings" className="hover:text-brand-600 hover:underline">
          Trainings
        </Link>
        <span aria-hidden> › </span>
        <span className="font-medium text-slate-700">{t.title}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
            <Badge tone={phaseTone[phase]}>{phase}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {trainingDates(t)}
            {t.trainer && ` · trainer ${t.trainer}`}
          </p>
          {t.description && <p className="mt-3 max-w-2xl text-sm text-slate-700">{t.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="secondary" className="text-red-700" onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Enrolled{enrolled.isSuccess && ` (${people.length})`}</h2>

      {/* enrol someone */}
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (chosen) enrol.mutate(chosen)
        }}
      >
        <div className="w-full max-w-xs">
          <SelectField
            label="Enrol an employee"
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
            placeholder={employees.isPending ? 'Loading…' : candidates.length === 0 ? 'Everyone is enrolled' : 'Choose an employee…'}
            options={candidates}
            disabled={employees.isPending || enrolled.isPending || candidates.length === 0}
          />
        </div>
        <Button type="submit" disabled={!chosen || enrol.isPending}>
          {enrol.isPending ? 'Enrolling…' : 'Enrol'}
        </Button>
      </form>
      {actionError && (
        <div className="mb-4">
          <ErrorMessage message={errorMessage(actionError)} />
        </div>
      )}

      {enrolled.isPending && <Loading />}
      {enrolled.isError && <LoadError message={errorMessage(enrolled.error)} onRetry={() => enrolled.refetch()} />}
      {enrolled.isSuccess &&
        (people.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            Nobody is enrolled yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Employees enrolled in {t.title}</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Department</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((person) => (
                  <tr key={person.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {person.firstName} {person.lastName}
                      </div>
                      <div className="text-xs text-slate-500">{person.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{person.department?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          variant="secondary"
                          className="px-2.5 py-1 text-red-700"
                          disabled={unenrol.isPending}
                          onClick={() => unenrol.mutate(person.id)}
                          aria-label={`Remove ${person.firstName} ${person.lastName} from this training`}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <Modal open={editing} title="Edit training" onClose={() => setEditing(false)}>
        <TrainingForm initial={t} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </Modal>

      <ConfirmDialog
        open={deleting}
        title="Delete training"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onCancel={() => {
          setDeleting(false)
          remove.reset()
        }}
        onConfirm={() => remove.mutate()}
      >
        Delete <strong className="text-slate-900">{t.title}</strong>? Everyone enrolled is removed from it first.
      </ConfirmDialog>
    </div>
  )
}
