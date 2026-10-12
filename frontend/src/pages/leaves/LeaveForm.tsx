import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, errorMessage } from '../../api/client'
import { listAllEmployees } from '../../api/employees'
import { createLeave, getEmployeeLeaveBalance, updateLeave } from '../../api/leaves'
import { createMyLeave, getMyLeaveBalance, updateMyLeave } from '../../api/me'
import { LEAVE_TYPES } from '../../api/types'
import type { LeaveRequest, LeaveType } from '../../api/types'
import { Button } from '../../components/Button'
import { ErrorMessage } from '../../components/Feedback'
import { SelectField, TextAreaField, TextField } from '../../components/Fields'
import { useToast } from '../../hooks/useToast'
import { today, workingDays } from '../../lib/dates'
import { leaveTypeLabel } from '../../lib/leave'

interface LeaveFormProps {
  /** the request being edited (only a pending one can be), or undefined to submit a new one */
  initial?: LeaveRequest
  /** an employee asking for their own leave: no employee to choose, and the /me endpoints are used */
  selfService?: boolean
  onSaved: () => void
  onCancel: () => void
}

export function LeaveForm({ initial, selfService = false, onSaved, onCancel }: LeaveFormProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  // only HR / administrators pick an employee (and only they may list them)
  const employees = useQuery({ queryKey: ['employees', 'all'], queryFn: listAllEmployees, enabled: !selfService })

  const [employeeId, setEmployeeId] = useState(initial?.employee.id ?? '')
  const [type, setType] = useState<LeaveType | ''>(initial?.type ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? today())
  const [endDate, setEndDate] = useState(initial?.endDate ?? today())
  const [reason, setReason] = useState(initial?.reason ?? '')

  // what is left of the chosen kind of leave in the year the request starts, to warn before the server refuses
  const year = Number(startDate.slice(0, 4)) || Number(today().slice(0, 4))
  const balanceOwner = selfService ? 'me' : employeeId
  const balances = useQuery({
    queryKey: selfService ? ['my', 'leave-balance', year] : ['leaves', 'balance', balanceOwner, year],
    queryFn: () => (selfService ? getMyLeaveBalance(year) : getEmployeeLeaveBalance(employeeId, year)),
    enabled: Boolean(balanceOwner),
  })
  const balance = type ? balances.data?.find((b) => b.type === type) : undefined
  const asked = startDate && endDate && endDate >= startDate ? workingDays(startDate, endDate) : 0
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4)
  // the request being edited already counts against the balance, so give its days back
  const own = initial && initial.type === type && initial.startDate.slice(0, 4) === startDate.slice(0, 4) && initial.endDate.slice(0, 4) === startDate.slice(0, 4)
    ? workingDays(initial.startDate, initial.endDate)
    : 0
  const left = balance?.remaining != null ? balance.remaining + own : null

  const employeeOptions = useMemo(
    () =>
      [...(employees.data ?? [])]
        .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
        .map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })),
    [employees.data],
  )

  const save = useMutation({
    mutationFn: () => {
      const input = {
        startDate: startDate || null,
        endDate: endDate || null,
        type: type || null,
        reason: reason.trim() || null,
      }
      if (selfService) {
        // the server files it for the signed-in person, whatever the body says
        return initial ? updateMyLeave(initial.id, input) : createMyLeave(input)
      }
      // the owner of a request never changes, so only a new one sends the employee
      return initial ? updateLeave(initial.id, input) : createLeave({ ...input, employee: employeeId ? { id: employeeId } : null })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [selfService ? 'my' : 'leaves'] })
      toast(initial ? 'Leave request saved' : 'Leave request submitted')
      onSaved()
    },
  })

  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const generalError = save.error && Object.keys(fieldErrors).length === 0 ? errorMessage(save.error) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {generalError && <ErrorMessage message={generalError} />}

      {!selfService && (
        <SelectField
          label="Employee"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          error={fieldErrors.employee}
          placeholder={employees.isPending ? 'Loading…' : 'Choose an employee…'}
          options={employeeOptions}
          // a request stays with its employee once submitted
          disabled={Boolean(initial) || employees.isPending}
          autoFocus={!initial}
        />
      )}
      <SelectField
        label="Type"
        value={type}
        onChange={(e) => setType(e.target.value as LeaveType | '')}
        error={fieldErrors.type}
        placeholder="Choose a type…"
        options={LEAVE_TYPES.map((t) => ({ value: t, label: leaveTypeLabel(t) }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={fieldErrors.startDate} />
        <TextField
          label="End date"
          type="date"
          min={startDate || undefined}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          error={fieldErrors.endDate}
        />
      </div>
      {asked > 0 && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${left !== null && sameYear && asked > left ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-600'}`}
        >
          This is <strong>{asked}</strong> working {asked === 1 ? 'day' : 'days'} (Monday to Friday).
          {balance && left !== null && sameYear && (
            <>
              {' '}
              {asked > left
                ? `You only have ${Math.max(left, 0)} ${leaveTypeLabel(balance.type).toLowerCase()} ${Math.max(left, 0) === 1 ? 'day' : 'days'} left in ${year}, so this cannot be submitted.`
                : `You will have ${left - asked} ${leaveTypeLabel(balance.type).toLowerCase()} ${left - asked === 1 ? 'day' : 'days'} left in ${year}.`}
            </>
          )}
          {balance && balance.remaining === null && sameYear && ` ${leaveTypeLabel(balance.type)} leave has no limit.`}
        </p>
      )}
      <TextAreaField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} error={fieldErrors.reason} />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Submit request'}
        </Button>
      </div>
    </form>
  )
}
