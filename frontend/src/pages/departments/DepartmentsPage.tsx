import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { deleteDepartment, listDepartments } from '../../api/departments'
import { errorMessage } from '../../api/client'
import type { Department } from '../../api/types'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadError, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { useNewFromUrl } from '../../hooks/useNewFromUrl'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'
import { DepartmentForm } from './DepartmentForm'

export default function DepartmentsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  useDocumentTitle('Departments')
  const departments = useQuery({ queryKey: ['departments'], queryFn: listDepartments })

  const openNew = useNewFromUrl()
  const [editing, setEditing] = useState<Department | 'new' | null>(openNew ? 'new' : null)
  const [deleting, setDeleting] = useState<Department | null>(null)
  const [search, setSearch] = useState('')

  const remove = useMutation({
    mutationFn: (department: Department) => deleteDepartment(department.id),
    onSuccess: async (_data, department) => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast(`Deleted ${department.name}`)
      setDeleting(null)
    },
  })

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (departments.data ?? [])
      .filter((d) => !term || d.name.toLowerCase().includes(term) || d.code.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [departments.data, search])

  function closeDelete() {
    setDeleting(null)
    remove.reset()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
          <p className="text-sm text-slate-500">The organisational units employees belong to.</p>
        </div>
        <Button onClick={() => setEditing('new')}>New department</Button>
      </div>

      {departments.isPending && <Loading />}
      {departments.isError && <LoadError message={errorMessage(departments.error)} onRetry={() => departments.refetch()} />}

      {departments.isSuccess && (
        <>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code"
            aria-label="Search departments"
            className="mb-4 block w-full max-w-xs rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600"
          />

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              {departments.data.length === 0 ? 'No departments yet.' : 'No department matches your search.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
                <caption className="sr-only">Departments</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Name</th>
                    <th scope="col" className="px-4 py-3">Code</th>
                    <th scope="col" className="px-4 py-3">Description</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((department) => (
                    <tr key={department.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{department.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{department.code}</span>
                      </td>
                      <td className="max-w-sm truncate px-4 py-3 text-slate-600">{department.description ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" className="px-2.5 py-1" onClick={() => setEditing(department)}>
                            Edit
                          </Button>
                          <Button variant="secondary" className="px-2.5 py-1 text-red-700" onClick={() => setDeleting(department)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'New department' : 'Edit department'}
        onClose={() => setEditing(null)}
      >
        <DepartmentForm
          initial={editing === 'new' || editing === null ? undefined : editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete department"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onCancel={closeDelete}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        Delete <strong className="text-slate-900">{deleting?.name}</strong>? Its employees are kept, but they will no longer belong to a
        department.
      </ConfirmDialog>
    </div>
  )
}
