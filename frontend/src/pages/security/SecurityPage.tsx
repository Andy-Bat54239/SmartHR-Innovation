import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { beginTwoFactorSetup, disableTwoFactor, enableTwoFactor, getTwoFactorStatus, newRecoveryCodes, signOutEverywhere } from '../../api/auth'
import { ApiError, errorMessage } from '../../api/client'
import { getMe, setEmailNotifications } from '../../api/me'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ErrorMessage, LoadError, Loading } from '../../components/Feedback'
import { TextField } from '../../components/Fields'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'

/** How the signed-in person protects their account (two-factor sign-in) and which emails they get. */
export default function SecurityPage() {
  useDocumentTitle('Security')
  const { user, updateUser, expire } = useAuth()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()
  const status = useQuery({ queryKey: ['security', '2fa'], queryFn: getTwoFactorStatus })

  /** Reload both what this page shows and the account in the header/guards (it carries twoFactorEnabled). */
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['security'] })
    updateUser((await getMe()).user)
  }

  const emails = useMutation({
    mutationFn: (on: boolean) => setEmailNotifications(on),
    onSuccess: (account) => {
      updateUser(account)
      toast(account.emailNotifications ? 'Emails turned on' : 'Emails turned off')
    },
  })

  const signOutAll = useMutation({
    mutationFn: signOutEverywhere,
    // this device's login is gone too: back to the login page, saying why
    onSuccess: () => expire('You were signed out on every device. Sign in again to continue.'),
  })

  if (!user) return null

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-slate-500">Protect your account and choose which emails you get.</p>
      </div>

      {user.twoFactorSetupRequired && (
        <div role="alert" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Two-factor sign-in is required for your role.</strong> Set it up below. Nothing else in SmartHR works until you have.
        </div>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="two-factor-title">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 id="two-factor-title" className="text-lg font-semibold">Two-factor sign-in</h2>
          {status.isSuccess && <Badge tone={status.data.enabled ? 'green' : 'slate'}>{status.data.enabled ? 'On' : 'Off'}</Badge>}
          {status.isSuccess && status.data.required && <Badge tone="brand">Required for your role</Badge>}
        </div>
        <p className="mb-4 text-sm text-slate-600">
          After your password, SmartHR asks for a 6-digit code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy…).
          A stolen password alone is then not enough to get in.
        </p>

        {status.isPending && <Loading />}
        {status.isError && <LoadError message={errorMessage(status.error)} onRetry={() => status.refetch()} />}
        {status.isSuccess && (status.data.enabled ? <Enabled status={status.data} onChanged={refresh} /> : <Setup onDone={refresh} />)}
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="sessions-title">
        <h2 id="sessions-title" className="mb-1 text-lg font-semibold">Where you are signed in</h2>
        <p className="mb-4 text-sm text-slate-600">
          Used a shared computer, or lost a phone or laptop? End every login of your account on every device, this one included. You sign in again here
          afterwards. Your password and two-factor settings stay as they are.
        </p>
        <Button variant="secondary" className="text-red-700" onClick={() => setConfirmingSignOut(true)}>
          Sign out everywhere
        </Button>
      </section>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out everywhere"
        confirmLabel="Sign out everywhere"
        pending={signOutAll.isPending}
        error={signOutAll.isError ? errorMessage(signOutAll.error) : null}
        onCancel={() => {
          setConfirmingSignOut(false)
          signOutAll.reset()
        }}
        onConfirm={() => signOutAll.mutate()}
      >
        You will be signed out on every device, including this one, and have to sign in again. You get an email about it.
      </ConfirmDialog>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="email-title">
        <h2 id="email-title" className="mb-1 text-lg font-semibold">Email notifications</h2>
        <p className="mb-4 text-sm text-slate-600">
          Emails go to <strong className="text-slate-900">{user.username}</strong>
          {user.employee ? ' and the address on your employee record' : ''}: leave requests waiting for a decision (HR and administrators), decisions on your
          leave, trainings you are enrolled in and reminders the day before they start.
        </p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            checked={user.emailNotifications}
            disabled={emails.isPending}
            onChange={(e) => emails.mutate(e.target.checked)}
          />
          <span>
            <span className="font-medium text-slate-900">Send me emails about leave and trainings</span>
            <span className="block text-slate-500">
              Security alerts (a password or two-factor change, a recovery code used) are always sent, whatever you choose.
            </span>
          </span>
        </label>
        {emails.isError && <div className="mt-3"><ErrorMessage message={errorMessage(emails.error)} /></div>}
      </section>
    </div>
  )
}

/** Not on yet: make a secret, show the QR code, and ask for the first code to prove it works. */
function Setup({ onDone }: { onDone: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const begin = useMutation({ mutationFn: beginTwoFactorSetup })
  const enable = useMutation({
    mutationFn: () => enableTwoFactor(code.trim()),
    onSuccess: (recoveryCodes) => setCodes(recoveryCodes),
  })
  const fieldErrors = enable.error instanceof ApiError ? enable.error.fieldErrors : {}
  const generalError = enable.error && Object.keys(fieldErrors).length === 0 ? errorMessage(enable.error) : null

  if (codes) {
    return <RecoveryCodes codes={codes} onDone={() => void onDone()} />
  }

  if (!begin.data) {
    return (
      <>
        {begin.isError && <div className="mb-3"><ErrorMessage message={errorMessage(begin.error)} /></div>}
        <Button onClick={() => begin.mutate()} disabled={begin.isPending}>
          {begin.isPending ? 'Preparing…' : 'Set up two-factor sign-in'}
        </Button>
      </>
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    enable.mutate()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ol className="list-decimal space-y-4 pl-5 text-sm text-slate-700">
        <li>
          Open your authenticator app and scan this code:
          <div className="mt-3 inline-block rounded-xl border border-slate-200 bg-white p-3">
            <QRCodeSVG value={begin.data.otpauthUri} size={168} role="img" aria-label="QR code for the authenticator app" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Cannot scan it? Type this key into the app instead:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800 select-all">{begin.data.secret.match(/.{1,4}/g)?.join(' ')}</code>
          </p>
        </li>
        <li>
          Type the 6-digit code the app shows now:
          <div className="mt-2 max-w-48">
            <TextField
              label="Code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={fieldErrors.code}
              placeholder="123456"
            />
          </div>
        </li>
      </ol>
      {generalError && <ErrorMessage message={generalError} />}
      <Button type="submit" disabled={enable.isPending || code.trim() === ''}>
        {enable.isPending ? 'Checking…' : 'Turn on two-factor sign-in'}
      </Button>
    </form>
  )
}

/** The one-time recovery codes. Shown once, so the person must confirm they have kept them. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const text = codes.join('\n')

  function download() {
    const url = URL.createObjectURL(new Blob([`SmartHR recovery codes\nEach works once.\n\n${text}\n`], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'smarthr-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <strong>Two-factor sign-in is on.</strong> Keep these recovery codes somewhere safe. Each one works once if you lose your phone, and they are
        <strong> not shown again</strong>.
      </div>
      <ul className="grid max-w-md grid-cols-2 gap-2 rounded-xl bg-slate-50 p-4 font-mono text-sm text-slate-900 select-all">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => toast('Recovery codes copied'))
          }}
        >
          Copy
        </Button>
        <Button variant="secondary" onClick={download}>
          Download
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 rounded border-slate-300 text-brand-600" />
        I have saved these codes
      </label>
      <Button onClick={onDone} disabled={!saved}>
        Done
      </Button>
    </div>
  )
}

type Action = 'codes' | 'disable'

/** Already on: how many recovery codes are left, new codes, and (when the role allows) turning it off. */
function Enabled({ status, onChanged }: { status: { required: boolean; recoveryCodesLeft: number }; onChanged: () => Promise<void> }) {
  const [action, setAction] = useState<Action | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const toast = useToast()

  if (codes) {
    return <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />
  }

  return (
    <>
      <p className="mb-4 text-sm text-slate-700">
        You have <strong>{status.recoveryCodesLeft}</strong> unused recovery {status.recoveryCodesLeft === 1 ? 'code' : 'codes'}.
        {status.recoveryCodesLeft <= 2 && <span className="text-amber-700"> Make new ones soon.</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setAction('codes')}>
          Make new recovery codes
        </Button>
        {status.required ? (
          <p className="self-center text-sm text-slate-500">It cannot be turned off for your role.</p>
        ) : (
          <Button variant="secondary" className="text-red-700" onClick={() => setAction('disable')}>
            Turn off
          </Button>
        )}
      </div>

      <Modal open={action !== null} title={action === 'disable' ? 'Turn off two-factor sign-in' : 'Make new recovery codes'} onClose={() => setAction(null)}>
        {action && (
          <ConfirmWithCode
            action={action}
            onCancel={() => setAction(null)}
            onDone={async (newCodes) => {
              setAction(null)
              if (newCodes) setCodes(newCodes)
              else toast('Two-factor sign-in turned off')
              await onChanged()
            }}
          />
        )}
      </Modal>
    </>
  )
}

/** Changing two-factor settings asks for the password and a current code again. */
function ConfirmWithCode({ action, onCancel, onDone }: { action: Action; onCancel: () => void; onDone: (codes: string[] | null) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const run = useMutation({
    mutationFn: async () => {
      if (action === 'disable') {
        await disableTwoFactor(password, code.trim())
        return null
      }
      return newRecoveryCodes(password, code.trim())
    },
    onSuccess: (result) => void onDone(result),
  })
  const fieldErrors = run.error instanceof ApiError ? run.error.fieldErrors : {}
  const generalError = run.error && Object.keys(fieldErrors).length === 0 ? errorMessage(run.error) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    run.mutate()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-slate-600">
        {action === 'disable' ? 'Your account will only need a password again.' : 'The old codes stop working.'} Confirm with your password and a current code
        from your app.
      </p>
      {generalError && <ErrorMessage message={generalError} />}
      <TextField label="Password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} />
      <TextField
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={fieldErrors.code}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={run.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant={action === 'disable' ? 'danger' : 'primary'} disabled={run.isPending || !password || !code.trim()}>
          {run.isPending ? 'Working…' : action === 'disable' ? 'Turn off' : 'Make new codes'}
        </Button>
      </div>
    </form>
  )
}
