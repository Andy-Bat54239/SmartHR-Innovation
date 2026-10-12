import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, errorMessage } from '../../api/client'
import { listAllEmployees } from '../../api/employees'
import { createUser, updateUser } from '../../api/users'
import { ROLES } from '../../api/types'
import type { AccountCreated, Role, UserAccount } from '../../api/types'
import { Button } from '../../components/Button'
import { ErrorMessage } from '../../components/Feedback'
import { SelectField, TextField } from '../../components/Fields'
import { useToast } from '../../hooks/useToast'
import { roleLabel } from '../../lib/role'

interface UserFormProps {
  /** the account being edited, or undefined to create one */
  initial?: UserAccount
  /** the signed-in administrator's own account: its role and on/off switch cannot be changed (the API refuses it too) */
  isSelf?: boolean
  onCreated: (created: AccountCreated) => void
  onSaved: () => void
  onCancel: () => void
}

export function UserForm({ initial, isSelf = false, onCreated, onSaved, onCancel }: UserFormProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const employees = useQuery({ queryKey: ['employees', 'all'], queryFn: listAllEmployees })

  const [username, setUsername] = useState(initial?.username ?? '')
  const [role, setRole] = useState<Role>(initial?.role ?? 'EMPLOYEE')
  const [employeeId, setEmployeeId] = useState(initial?.employee?.id ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)

  const employeeOptions = useMemo(
    () =>
      [...(employees.data ?? [])]
        .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
        .map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })),
    [employees.data],
  )

  const save = useMutation({
    mutationFn: async () => {
      const link = employeeId || null
      if (initial) {
        await updateUser(initial.id, { role, enabled, employeeId: link })
        return null
      }
      return createUser({ username: username.trim(), role, employeeId: link })
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      if (created) {
        toast('Account created')
        onCreated(created)
      } else {
        toast('Account saved')
        onSaved()
      }
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
      <TextField
        label="Username (an email address)"
        type="email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={fieldErrors.username}
        disabled={Boolean(initial)}
        autoFocus={!initial}
        autoComplete="off"
      />
      <SelectField
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        error={fieldErrors.role}
        options={ROLES.map((r) => ({ value: r, label: roleLabel[r] }))}
        disabled={isSelf}
      />
      <SelectField
        label={role === 'EMPLOYEE' ? 'Employee' : 'Employee (optional)'}
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        error={fieldErrors.employeeId}
        placeholder={employees.isPending ? 'Loading…' : 'No employee'}
        options={employeeOptions}
        disabled={employees.isPending}
      />
      <p className="-mt-2 text-xs text-slate-500">
        {role === 'EMPLOYEE'
          ? 'An employee account sees only its own profile, leave and trainings, so it must belong to an employee.'
          : 'Link an employee if this person should also be able to ask for their own leave.'}
      </p>
      {initial && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={isSelf} className="size-4 rounded border-slate-300" />
          Account is switched on (switching it off signs the person out at once)
        </label>
      )}
      {isSelf && <p className="text-xs text-slate-500">This is your own account: you cannot change its role or switch it off.</p>}
      {!initial && <p className="text-xs text-slate-500">A temporary password is generated and shown once. The person must change it at their first sign-in.</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Create account'}
        </Button>
      </div>
    </form>
  )
}
