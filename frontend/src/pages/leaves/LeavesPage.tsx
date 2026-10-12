import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { errorMessage } from '../../api/client'
import { listAllEmployees } from '../../api/employees'
import { approveLeave, LEAVE_SORT_FIELDS, rejectLeave, searchLeaves } from '../../api/leaves'
import type { LeaveQuery } from '../../api/leaves'
import { LEAVE_STATUSES, LEAVE_TYPES } from '../../api/types'
import type { LeaveRequest } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { TextAreaField } from '../../components/Fields'
import { LoadError, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { SortHeader } from '../../components/SortHeader'
import { useNewFromUrl } from '../../hooks/useNewFromUrl'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'
import { oneOf, useKeepPageInRange, useUrlParams, wholeNumber } from '../../hooks/useUrlParams'
import { daysBetween, formatDate } from '../../lib/dates'
import { leaveStatusLabel, leaveStatusTone, leaveTypeLabel } from '../../lib/leave'
import { PAGE_SIZES } from '../../lib/paging'
import { filterControl } from '../../lib/styles'
import { LeaveForm } from './LeaveForm'

/** Anything the URL holds that we do not recognise falls back to a default. Newest requests come first. */
function parseQuery(params: URLSearchParams): LeaveQuery {
  const size = wholeNumber(params, 'size', PAGE_SIZES[0])
  return {
    page: wholeNumber(params, 'page', 0),
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : PAGE_SIZES[0],
    sortBy: oneOf(params.get('sortBy'), LEAVE_SORT_FIELDS) ?? 'startDate',
    direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
    status: oneOf(params.get('status'), LEAVE_STATUSES),
    type: oneOf(params.get('type'), LEAVE_TYPES),
    employeeId: params.get('employeeId') || undefined,
  }
}

interface Decision {
  leave: LeaveRequest
  action: 'approve' | 'reject'
}

export default function LeavesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  useDocumentTitle('Leave requests')
  const { params, update } = useUrlParams()
  const query = useMemo(() => parseQuery(params), [params])

  const openNew = useNewFromUrl()
  const [editing, setEditing] = useState<'new' | null>(openNew ? 'new' : null)
  const [deciding, setDeciding] = useState<Decision | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  const leaves = useQuery({
    queryKey: ['leaves', query],
    queryFn: () => searchLeaves(query),
    placeholderData: keepPreviousData,
  })
  const employees = useQuery({ queryKey: ['employees', 'all'], queryFn: listAllEmployees })

  useKeepPageInRange(leaves.isPlaceholderData ? undefined : leaves.data?.page.totalPages, query.page, update)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['leaves'] })

  const decide = useMutation({
    mutationFn: ({ leave, action }: Decision) =>
      action === 'approve' ? approveLeave(leave.id) : rejectLeave(leave.id, rejectReason.trim()),
    onSuccess: async (_data, { leave, action }) => {
      await refresh()
      toast(`${leave.employee.firstName} ${leave.employee.lastName}'s leave ${action === 'approve' ? 'approved' : 'rejected'}`)
      setDeciding(null)
    },
    // most likely someone else decided it first: reload so the row shows what really happened
    onError: () => void refresh(),
  })

  function openDecision(decision: Decision) {
    setRejectReason('')
    setReasonError(null)
    decide.reset()
    setDeciding(decision)
  }
  function closeDecision() {
    setDeciding(null)
    setRejectReason('')
    setReasonError(null)
    decide.reset()
  }
  function confirmDecision() {
    if (!deciding) return
    if (deciding.action === 'reject' && !rejectReason.trim()) {
      setReasonError('Give a reason for rejecting this request')
      return
    }
    decide.mutate(deciding)
  }
  function sortBy(field: string) {
    if (query.sortBy === field) update({ direction: query.direction === 'asc' ? 'desc' : 'asc' })
    else update({ sortBy: field, direction: field === 'startDate' || field === 'endDate' ? 'desc' : 'asc' })
  }

  const filtersActive = Boolean(query.status || query.type || query.employeeId)
  const data = leaves.data

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leave requests</h1>
          <p className="text-sm text-slate-500">Time off that staff have asked for, waiting for a decision or already decided.</p>
        </div>
        <Button onClick={() => setEditing('new')}>New request</Button>
      </div>

      {/* status tabs + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by status" className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
          {[undefined, ...LEAVE_STATUSES].map((status) => (
            <button
              key={status ?? 'all'}
              type="button"
              aria-pressed={query.status === status}
              onClick={() => update({ status })}
              className={`rounded-md px-3 py-1.5 font-medium ${
                query.status === status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {status ? leaveStatusLabel(status) : 'All'}
            </button>
          ))}
        </div>
        <select aria-label="Filter by type" value={query.type ?? ''} onChange={(e) => update({ type: e.target.value })} className={filterControl}>
          <option value="">Any type</option>
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>{leaveTypeLabel(t)}</option>
          ))}
        </select>
        <select aria-label="Filter by employee" value={query.employeeId ?? ''} onChange={(e) => update({ employeeId: e.target.value })} className={filterControl}>
          <option value="">Any employee</option>
          {[...(employees.data ?? [])]
            .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
            .map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
        </select>
        {filtersActive && (
          <Button variant="secondary" onClick={() => update({ status: undefined, type: undefined, employeeId: undefined })}>
            Clear filters
          </Button>
        )}
      </div>

      {leaves.isPending && <Loading />}
      {leaves.isError && <LoadError message={errorMessage(leaves.error)} onRetry={() => leaves.refetch()} />}

      {data && (
        <div className={leaves.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {data.content.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              {filtersActive ? 'No leave request matches these filters.' : 'No leave requests yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
                <caption className="sr-only">Leave requests</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Employee</th>
                    <SortHeader label="Type" field="type" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <SortHeader label="Dates" field="startDate" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <th scope="col" className="px-4 py-3">Reason</th>
                    <SortHeader label="Status" field="status" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.content.map((leave) => (
                    <LeaveRow
                      key={leave.id}
                      leave={leave}
                      onApprove={() => openDecision({ leave, action: 'approve' })}
                      onReject={() => openDecision({ leave, action: 'reject' })}
                    />
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

      <Modal open={editing !== null} title="New leave request" onClose={() => setEditing(null)}>
        <LeaveForm
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </Modal>

      <ConfirmDialog
        open={deciding !== null}
        title={deciding?.action === 'approve' ? 'Approve leave request' : 'Reject leave request'}
        confirmLabel={deciding?.action === 'approve' ? 'Approve' : 'Reject'}
        tone={deciding?.action === 'approve' ? 'primary' : 'danger'}
        pending={decide.isPending}
        error={decide.isError ? errorMessage(decide.error) : null}
        onCancel={closeDecision}
        onConfirm={confirmDecision}
      >
        {deciding && (
          <div className="space-y-4">
            <p>
            {deciding.action === 'approve' ? 'Approve' : 'Reject'}{' '}
            <strong className="text-slate-900">
              {deciding.leave.employee.firstName} {deciding.leave.employee.lastName}
            </strong>
            's {leaveTypeLabel(deciding.leave.type).toLowerCase()} leave from {formatDate(deciding.leave.startDate)} to{' '}
            {formatDate(deciding.leave.endDate)} ({daysBetween(deciding.leave.startDate, deciding.leave.endDate)} days)? A decision cannot be changed
            afterwards.
            </p>
            {deciding.action === 'reject' && (
              <TextAreaField
                label="Reason for rejecting (required, the employee will see it)"
                value={rejectReason}
                maxLength={1000}
                error={reasonError ?? undefined}
                onChange={(e) => {
                  setRejectReason(e.target.value)
                  setReasonError(null)
                }}
              />
            )}
          </div>
        )}
      </ConfirmDialog>

    </div>
  )
}

function LeaveRow({
  leave,
  onApprove,
  onReject,
}: {
  leave: LeaveRequest
  onApprove: () => void
  onReject: () => void
}) {
  const days = daysBetween(leave.startDate, leave.endDate)
  const pending = leave.status === 'PENDING'

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">
          {leave.employee.firstName} {leave.employee.lastName}
        </div>
        <div className="text-xs text-slate-500">{leave.employee.department?.name ?? 'No department'}</div>
      </td>
      <td className="px-4 py-3">
        <Badge tone="brand">{leaveTypeLabel(leave.type)}</Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
        <div>
          {formatDate(leave.startDate)}
          {leave.endDate !== leave.startDate && ` – ${formatDate(leave.endDate)}`}
        </div>
        <div className="text-xs text-slate-500">
          {days} {days === 1 ? 'day' : 'days'}
        </div>
      </td>
      <td className="max-w-56 truncate px-4 py-3 text-slate-600" title={leave.reason ?? undefined}>
        {leave.reason ?? <span className="text-slate-400">—</span>}
      </td>
      <td className="px-4 py-3">
        <Badge tone={leaveStatusTone[leave.status]}>{leaveStatusLabel(leave.status)}</Badge>
        {leave.rejectionReason && (
          <div className="mt-1 max-w-56 text-xs text-red-700" title={leave.rejectionReason}>
            Rejected: {leave.rejectionReason}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
          {pending && (
            <>
              <Button className="px-2.5 py-1" onClick={onApprove}>
                Approve
              </Button>
              <Button variant="secondary" className="px-2.5 py-1 text-red-700" onClick={onReject}>
                Reject
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
