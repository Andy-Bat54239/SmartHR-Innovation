import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { deleteUser, listUsers, resetPassword, resetTwoFactor } from '../../api/users'
import type { AccountCreated, UserAccount } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorMessage, LoadError, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'
import { roleLabel, roleTone } from '../../lib/role'
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog'
import { UserForm } from './UserForm'

/** Accounts: who can sign in, as what. Administrators only. */
export default function UsersPage() {
  useDocumentTitle('Accounts')
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user: me } = useAuth()
  const users = useQuery({ queryKey: ['users'], queryFn: listUsers })

  const [editing, setEditing] = useState<UserAccount | 'new' | null>(null)
  const [deleting, setDeleting] = useState<UserAccount | null>(null)
  const [resetting, setResetting] = useState<UserAccount | null>(null)
  const [resettingTwoFactor, setResettingTwoFactor] = useState<UserAccount | null>(null)
  // a generated password being shown, with the sentence that introduces it
  const [shown, setShown] = useState<{ result: AccountCreated; heading: string } | null>(null)

  const remove = useMutation({
    mutationFn: (account: UserAccount) => deleteUser(account.id),
    onSuccess: async (_data, account) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast(`Deleted ${account.username}`)
      setDeleting(null)
    },
  })

  const reset = useMutation({
    mutationFn: (account: UserAccount) => resetPassword(account.id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setResetting(null)
      setShown({ result, heading: 'New temporary password for' })
    },
  })

  const resetFactor = useMutation({
    mutationFn: (account: UserAccount) => resetTwoFactor(account.id),
    onSuccess: async (_data, account) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast(`Two-factor sign-in reset for ${account.username}`)
      setResettingTwoFactor(null)
    },
  })

  function closeResetTwoFactor() {
    setResettingTwoFactor(null)
    resetFactor.reset()
  }
  function closeDelete() {
    setDeleting(null)
    remove.reset()
  }
  function closeReset() {
    setResetting(null)
    reset.reset()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-slate-500">Who can sign in, and what they may do.</p>
        </div>
        <Button onClick={() => setEditing('new')}>New account</Button>
      </div>

      <div className="mb-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <p><Badge tone="brand">Administrator</Badge> Everything HR can do, and manages accounts.</p>
        <p><Badge tone="green">HR</Badge> Employees, leave, trainings, departments, locations.</p>
        <p><Badge tone="slate">Employee</Badge> Only their own profile, leave and trainings.</p>
      </div>

      {users.isPending && <Loading />}
      {users.isError && <LoadError message={errorMessage(users.error)} onRetry={() => users.refetch()} />}

      {users.isSuccess && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
            <caption className="sr-only">Accounts</caption>
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">Username</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Employee</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.data.map((account) => {
                const isSelf = account.id === me?.id
                return (
                  <tr key={account.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {account.username}
                      {isSelf && <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={roleTone[account.role]}>{roleLabel[account.role]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {account.employee ? `${account.employee.firstName} ${account.employee.lastName}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={account.enabled ? 'green' : 'red'}>{account.enabled ? 'Active' : 'Switched off'}</Badge>
                        {account.mustChangePassword && <Badge tone="amber">Temporary password</Badge>}
                        {account.twoFactorEnabled ? <Badge tone="green">2FA on</Badge> : account.twoFactorSetupRequired ? <Badge tone="amber">2FA not set up</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="secondary" className="px-2.5 py-1" onClick={() => setEditing(account)}>
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          className="px-2.5 py-1"
                          onClick={() => setResetting(account)}
                          disabled={isSelf}
                          title={isSelf ? 'Use "Change password" in the menu for your own account' : undefined}
                        >
                          Reset password
                        </Button>
                        {account.twoFactorEnabled && !isSelf && (
                          <Button variant="secondary" className="px-2.5 py-1" onClick={() => setResettingTwoFactor(account)}>
                            Reset 2FA
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          className="px-2.5 py-1 text-red-700"
                          onClick={() => setDeleting(account)}
                          disabled={isSelf}
                          title={isSelf ? 'You cannot delete your own account' : undefined}
                        >
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

      <Modal open={editing !== null} title={editing === 'new' ? 'New account' : 'Edit account'} onClose={() => setEditing(null)}>
        <UserForm
          initial={editing === 'new' || editing === null ? undefined : editing}
          isSelf={editing !== 'new' && editing !== null && editing.id === me?.id}
          onCreated={(created) => {
            setEditing(null)
            setShown({ result: created, heading: 'Account created for' })
          }}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </Modal>

      <TemporaryPasswordDialog result={shown?.result ?? null} heading={shown?.heading ?? ''} onClose={() => setShown(null)} />

      <ConfirmDialog
        open={resetting !== null}
        title="Reset password"
        confirmLabel="Reset password"
        pending={reset.isPending}
        error={reset.isError ? errorMessage(reset.error) : null}
        onCancel={closeReset}
        onConfirm={() => resetting && reset.mutate(resetting)}
      >
        Give <strong className="text-slate-900">{resetting?.username}</strong> a new temporary password? Their current password stops working and
        they are signed out everywhere.
      </ConfirmDialog>

      <ConfirmDialog
        open={resettingTwoFactor !== null}
        title="Reset two-factor sign-in"
        confirmLabel="Reset 2FA"
        pending={resetFactor.isPending}
        error={resetFactor.isError ? errorMessage(resetFactor.error) : null}
        onCancel={closeResetTwoFactor}
        onConfirm={() => resettingTwoFactor && resetFactor.mutate(resettingTwoFactor)}
      >
        Remove the authenticator app of <strong className="text-slate-900">{resettingTwoFactor?.username}</strong> (for example, they lost their phone)? They
        are signed out everywhere and sign in with just their password
        {resettingTwoFactor?.role === 'ADMIN' ? ', then must set two-factor sign-in up again' : ' until they turn it on again'}. They get an email about it.
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete account"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onCancel={closeDelete}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        Delete the account <strong className="text-slate-900">{deleting?.username}</strong>? They can no longer sign in. Their employee record, if they have
        one, is not affected.
      </ConfirmDialog>

      {reset.isError && resetting === null && <ErrorMessage message={errorMessage(reset.error)} />}
    </div>
  )
}
