import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { errorMessage } from '../../api/client'
import { getMe } from '../../api/me'
import { Badge } from '../../components/Badge'
import { LoadError, Loading } from '../../components/Feedback'
import { Panel } from '../../components/Panel'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { formatDate } from '../../lib/dates'
import { locationPath } from '../../lib/location'
import { roleLabel } from '../../lib/role'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm text-slate-900">{children ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  )
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

/** The signed-in person's own details: read only. */
export default function MyProfilePage() {
  useDocumentTitle('My profile')
  const me = useQuery({ queryKey: ['my', 'me'], queryFn: getMe })

  if (me.isPending) return <Loading />
  if (me.isError) return <LoadError message={errorMessage(me.error)} onRetry={() => me.refetch()} />

  const { user, employee } = me.data
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{employee ? `${employee.firstName} ${employee.lastName}` : 'My profile'}</h1>
        <p className="text-sm text-slate-500">Your details as they are on record. Ask HR if something needs correcting.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Employment">
          {employee ? (
            <dl className="space-y-3">
              <Detail label="Email">{employee.email}</Detail>
              <Detail label="Phone">{employee.phone}</Detail>
              <Detail label="Department">{employee.department?.name}</Detail>
              <Detail label="Location">{employee.location ? locationPath(employee.location) : null}</Detail>
              <Detail label="Hired">{formatDate(employee.hireDate)}</Detail>
              <Detail label="Status">
                <Badge tone={employee.status === 'ACTIVE' ? 'green' : 'slate'}>{titleCase(employee.status)}</Badge>
              </Detail>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">This account is not linked to an employee record, so there are no employment details to show.</p>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Personal details">
            {employee?.profile ? (
              <dl className="space-y-3">
                <Detail label="National ID">{employee.profile.nationalId}</Detail>
                <Detail label="Date of birth">{formatDate(employee.profile.dateOfBirth)}</Detail>
                <Detail label="Education">{employee.profile.educationLevel}</Detail>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No personal details have been recorded yet.</p>
            )}
          </Panel>
          <Panel title="Your account">
            <dl className="space-y-3">
              <Detail label="Username">{user.username}</Detail>
              <Detail label="Role">{roleLabel[user.role]}</Detail>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}
