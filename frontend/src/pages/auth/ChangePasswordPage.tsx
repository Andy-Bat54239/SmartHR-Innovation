import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { changePassword } from '../../api/auth'
import { ApiError, errorMessage } from '../../api/client'
import { AuthShell } from '../../components/AuthShell'
import { Button } from '../../components/Button'
import { ErrorMessage } from '../../components/Feedback'
import { TextField } from '../../components/Fields'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'

/**
 * Two uses: forced (right after signing in with a temporary password: nothing else is reachable until it is done)
 * and voluntary (from the menu). Changing the password signs out every other session, so the API answers with a new token.
 */
export default function ChangePasswordPage() {
  useDocumentTitle('Change password')
  const { user, completeLogin, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const forced = user?.mustChangePassword === true

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState<string>()

  const change = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: (response) => {
      completeLogin(response)
      toast('Password changed')
      navigate('/', { replace: true })
    },
  })
  const fieldErrors = change.error instanceof ApiError ? change.error.fieldErrors : {}
  const generalError = change.error && Object.keys(fieldErrors).length === 0 ? errorMessage(change.error) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    if (next !== confirm) {
      setMismatch('The two passwords do not match')
      return
    }
    setMismatch(undefined)
    change.mutate()
  }

  return (
    <AuthShell
      title={forced ? 'Choose a new password' : 'Change password'}
      subtitle={forced ? 'You signed in with a temporary password. Choose your own to continue.' : 'Every other place you are signed in will be signed out.'}
    >
      <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
        {generalError && <ErrorMessage message={generalError} />}
        <TextField
          label={forced ? 'Temporary password' : 'Current password'}
          type="password"
          autoComplete="current-password"
          autoFocus
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={fieldErrors.currentPassword}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={fieldErrors.newPassword}
        />
        <p className="-mt-2 text-xs text-slate-500">At least 8 characters, and not your username.</p>
        <TextField
          label="Repeat the new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch}
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          {forced ? (
            <Button variant="secondary" onClick={signOut} disabled={change.isPending}>
              Sign out
            </Button>
          ) : (
            <Link to="/" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </Link>
          )}
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </div>
      </form>
    </AuthShell>
  )
}
