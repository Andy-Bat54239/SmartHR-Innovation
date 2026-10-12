import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { getMyLeaveBalance, listMyLeave, withdrawMyLeave } from '../../api/me'
import type { LeaveRequest } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { LeaveBalanceCards } from '../../components/LeaveBalanceCards'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadError, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'
import { daysBetween, formatDate } from '../../lib/dates'
import { leaveStatusLabel, leaveStatusTone, leaveTypeLabel } from '../../lib/leave'
import { LeaveForm } from '../leaves/LeaveForm'

/** The signed-in person's own leave: ask for it, change it while it is pending, or withdraw it. */
export default function MyLeavePage() {
  useDocumentTitle('My leave')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const linked = user?.employee != null
  const leave = useQuery({ queryKey: ['my', 'leave'], queryFn: listMyLeave, enabled: linked })
  const balance = useQuery({ queryKey: ['my', 'leave-balance'], queryFn: () => getMyLeaveBalance(), enabled: linked })

  const [editing, setEditing] = useState<LeaveRequest | 'new' | null>(null)
  const [withdrawing, setWithdrawing] = useState<LeaveRequest | null>(null)

  const withdraw = useMutation({
    mutationFn: (request: LeaveRequest) => withdrawMyLeave(request.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my'] })
      toast('Leave request withdrawn')
      setWithdrawing(null)
    },
    // most likely it was decided a moment ago: reload so the row shows its real status
    onError: () => void queryClient.invalidateQueries({ queryKey: ['my'] }),
  })

  function closeWithdraw() {
    setWithdrawing(null)
    withdraw.reset()
  }

  if (!linked) {
    return <p className="py-10 text-sm text-slate-500">This account is not linked to an employee record, so it has no leave of its own.</p>
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My leave</h1>
          <p className="text-sm text-slate-500">Ask for time off and follow what has been decided.</p>
        </div>
        <Button onClick={() => setEditing('new')}>New request</Button>
      </div>

      {balance.isSuccess && <LeaveBalanceCards balances={balance.data} />}

      {leave.isPending && <Loading />}
      {leave.isError && <LoadError message={errorMessage(leave.error)} onRetry={() => leave.refetch()} />}

      {leave.isSuccess &&
        (leave.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
            You have not asked for any leave yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">My leave requests</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Dates</th>
                  <th scope="col" className="px-4 py-3">Reason</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leave.data.map((request) => {
                  const days = daysBetween(request.startDate, request.endDate)
                  return (
                    <tr key={request.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Badge tone="brand">{leaveTypeLabel(request.type)}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        <div>
                          {formatDate(request.startDate)}
                          {request.endDate !== request.startDate && ` – ${formatDate(request.endDate)}`}
                        </div>
                        <div className="text-xs text-slate-500">
                          {days} {days === 1 ? 'day' : 'days'}
                        </div>
                      </td>
                      <td className="max-w-56 truncate px-4 py-3 text-slate-600" title={request.reason ?? undefined}>
                        {request.reason ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={leaveStatusTone[request.status]}>{leaveStatusLabel(request.status)}</Badge>
                        {request.rejectionReason && (
                          <div className="mt-1 max-w-56 text-xs text-red-700">Reason: {request.rejectionReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {request.status === 'PENDING' ? (
                            <>
                              <Button variant="secondary" className="px-2.5 py-1" onClick={() => setEditing(request)}>
                                Edit
                              </Button>
                              <Button variant="secondary" className="px-2.5 py-1 text-red-700" onClick={() => setWithdrawing(request)}>
                                Withdraw
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Decided</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

      <Modal open={editing !== null} title={editing === 'new' ? 'New leave request' : 'Edit leave request'} onClose={() => setEditing(null)}>
        <LeaveForm
          selfService
          initial={editing === 'new' || editing === null ? undefined : editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </Modal>

      <ConfirmDialog
        open={withdrawing !== null}
        title="Withdraw leave request"
        confirmLabel="Withdraw"
        pending={withdraw.isPending}
        error={withdraw.isError ? errorMessage(withdraw.error) : null}
        onCancel={closeWithdraw}
        onConfirm={() => withdrawing && withdraw.mutate(withdrawing)}
      >
        Withdraw your {withdrawing && leaveTypeLabel(withdrawing.type).toLowerCase()} leave request
        {withdrawing && ` for ${formatDate(withdrawing.startDate)}`}? It is removed, and nobody will decide on it.
      </ConfirmDialog>
    </div>
  )
}
