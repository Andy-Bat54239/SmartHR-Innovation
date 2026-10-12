import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { errorMessage } from '../../api/client'
import { listDepartments } from '../../api/departments'
import { deleteEmployee, EMPLOYEE_SORT_FIELDS, searchEmployees } from '../../api/employees'
import type { EmployeeQuery } from '../../api/employees'
import { listProvinces } from '../../api/locations'
import { EMPLOYEE_STATUSES, GENDERS } from '../../api/types'
import type { Employee } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadError, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { SortHeader } from '../../components/SortHeader'
import { useNewFromUrl } from '../../hooks/useNewFromUrl'
import { oneOf, useKeepPageInRange, useUrlParams, wholeNumber } from '../../hooks/useUrlParams'
import { useUrlSearchBox } from '../../hooks/useUrlSearchBox'
import { formatDate } from '../../lib/dates'
import { locationChain, locationPath } from '../../lib/location'
import { PAGE_SIZES } from '../../lib/paging'
import { filterControl } from '../../lib/styles'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'
import { EmployeeForm } from './EmployeeForm'

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

/** Anything the URL holds that we do not recognise falls back to a default. */
function parseQuery(params: URLSearchParams): EmployeeQuery {
  const size = wholeNumber(params, 'size', PAGE_SIZES[0])
  return {
    page: wholeNumber(params, 'page', 0),
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : PAGE_SIZES[0],
    sortBy: oneOf(params.get('sortBy'), EMPLOYEE_SORT_FIELDS) ?? 'lastName',
    direction: params.get('direction') === 'desc' ? 'desc' : 'asc',
    q: params.get('q') || undefined,
    status: oneOf(params.get('status'), EMPLOYEE_STATUSES),
    gender: oneOf(params.get('gender'), GENDERS),
    departmentId: params.get('departmentId') || undefined,
    provinceId: params.get('provinceId') || undefined,
  }
}

export default function EmployeesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  useDocumentTitle('Employees')
  const { params, update } = useUrlParams()
  const query = useMemo(() => parseQuery(params), [params])

  const openNew = useNewFromUrl()
  const [editing, setEditing] = useState<Employee | 'new' | null>(openNew ? 'new' : null)
  const [deleting, setDeleting] = useState<Employee | null>(null)

  const employees = useQuery({
    queryKey: ['employees', query],
    queryFn: () => searchEmployees(query),
    placeholderData: keepPreviousData, // keep showing the old page while the next one loads
  })
  const departments = useQuery({ queryKey: ['departments'], queryFn: listDepartments })
  const provinces = useQuery({ queryKey: ['locations', 'provinces'], queryFn: listProvinces })

  // the search box: typing updates the URL after a pause, and the box follows the URL when something else changes it
  const search = useUrlSearchBox(query.q, (q) => update({ q }))

  useKeepPageInRange(employees.isPlaceholderData ? undefined : employees.data?.page.totalPages, query.page, update)

  const remove = useMutation({
    mutationFn: (employee: Employee) => deleteEmployee(employee.id),
    onSuccess: async (_data, employee) => {
      // deleting an employee also deletes their leave requests and training enrolments
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
        queryClient.invalidateQueries({ queryKey: ['leaves'] }),
        queryClient.invalidateQueries({ queryKey: ['trainings'] }),
      ])
      toast(`Deleted ${employee.firstName} ${employee.lastName}`)
      setDeleting(null)
    },
  })

  function closeDelete() {
    setDeleting(null)
    remove.reset()
  }

  function sortBy(field: string) {
    if (query.sortBy === field) update({ direction: query.direction === 'asc' ? 'desc' : 'asc' })
    else update({ sortBy: field, direction: 'asc' })
  }

  const filtersActive = Boolean(query.q || query.status || query.gender || query.departmentId || query.provinceId)
  function clearFilters() {
    search.reset()
    update({ q: undefined, status: undefined, gender: undefined, departmentId: undefined, provinceId: undefined })
  }

  const data = employees.data

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-slate-500">Everyone on staff, with their department and where they live.</p>
        </div>
        <Button onClick={() => setEditing('new')}>New employee</Button>
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search.text}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder="Search name, email or phone"
          aria-label="Search employees"
          className={`${filterControl} w-full sm:w-64`}
        />
        <select aria-label="Filter by status" value={query.status ?? ''} onChange={(e) => update({ status: e.target.value })} className={filterControl}>
          <option value="">Any status</option>
          {EMPLOYEE_STATUSES.map((s) => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </select>
        <select aria-label="Filter by gender" value={query.gender ?? ''} onChange={(e) => update({ gender: e.target.value })} className={filterControl}>
          <option value="">Any gender</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>{titleCase(g)}</option>
          ))}
        </select>
        <select aria-label="Filter by department" value={query.departmentId ?? ''} onChange={(e) => update({ departmentId: e.target.value })} className={filterControl}>
          <option value="">Any department</option>
          {[...(departments.data ?? [])]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
        </select>
        <select aria-label="Filter by province" value={query.provinceId ?? ''} onChange={(e) => update({ provinceId: e.target.value })} className={filterControl}>
          <option value="">Any province</option>
          {[...(provinces.data ?? [])]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
        {filtersActive && (
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {employees.isPending && <Loading />}
      {employees.isError && <LoadError message={errorMessage(employees.error)} onRetry={() => employees.refetch()} />}

      {data && (
        <div className={employees.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {data.content.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              {filtersActive ? 'No employee matches these filters.' : 'No employees yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
                <caption className="sr-only">Employees</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <SortHeader label="Name" field="lastName" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <th scope="col" className="px-4 py-3">Department</th>
                    <th scope="col" className="px-4 py-3">Location</th>
                    <SortHeader label="Hired" field="hireDate" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <SortHeader label="Status" field="status" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.content.map((employee) => (
                    <EmployeeRow key={employee.id} employee={employee} onEdit={() => setEditing(employee)} onDelete={() => setDeleting(employee)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={data.page.number}
            size={data.page.size}
            totalPages={data.page.totalPages}
            totalElements={data.page.totalElements}
            onPage={(page) => update({ page: page === 0 ? undefined : String(page) }, true)}
            onSize={(size) => update({ size: size === PAGE_SIZES[0] ? undefined : String(size) })}
          />
        </div>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'New employee' : 'Edit employee'} size="lg" onClose={() => setEditing(null)}>
        <EmployeeForm
          initial={editing === 'new' || editing === null ? undefined : editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete employee"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onCancel={closeDelete}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        Delete <strong className="text-slate-900">{deleting ? `${deleting.firstName} ${deleting.lastName}` : ''}</strong>? Their profile, leave
        requests and training enrolments are deleted with them.
      </ConfirmDialog>
    </div>
  )
}

function EmployeeRow({ employee, onEdit, onDelete }: { employee: Employee; onEdit: () => void; onDelete: () => void }) {
  const chain = locationChain(employee.location)
  const place = chain[chain.length - 1]
  const province = chain[0]

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">
          {employee.firstName} {employee.lastName}
        </div>
        <div className="text-xs text-slate-500">
          {employee.email} · {employee.phone}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">{employee.department?.name ?? <span className="text-slate-400">—</span>}</td>
      <td className="px-4 py-3 text-slate-700">
        {place ? (
          <span title={locationPath(employee.location)}>
            {place.name}
            {province && province.id !== place.id && <span className="text-slate-400"> · {province.name}</span>}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDate(employee.hireDate)}</td>
      <td className="px-4 py-3">
        <Badge tone={employee.status === 'ACTIVE' ? 'green' : 'slate'}>{titleCase(employee.status)}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="px-2.5 py-1" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="secondary" className="px-2.5 py-1 text-red-700" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  )
}
