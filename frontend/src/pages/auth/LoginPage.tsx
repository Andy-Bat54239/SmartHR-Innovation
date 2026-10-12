import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getSignInProviders, googleSignInUrl } from '../../api/auth'
import { ApiError, errorMessage } from '../../api/client'
import { AuthShell } from '../../components/AuthShell'
import { Button } from '../../components/Button'
import { ErrorMessage } from '../../components/Feedback'
import { TextField } from '../../components/Fields'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export default function LoginPage() {
  useDocumentTitle('Sign in')
  const { status, user, signIn, verifyCode, notice, clearNotice } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // set after a correct password for an account with two-factor sign-in: the second step is on screen
  // (a Google sign-in for an account with two-factor sign-in arrives here already at the second step, with a message if it failed)
  const arrival = useLocation().state as { challengeToken?: string; error?: string } | null
  const providers = useQuery({ queryKey: ['sign-in-providers'], queryFn: getSignInProviders, staleTime: 5 * 60_000, retry: false })
  const [challenge, setChallenge] = useState<string | null>(arrival?.challengeToken ?? null)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)

  const login = useMutation({
    mutationFn: () => signIn(username.trim(), password),
    onSuccess: (result) => {
      if ('challengeToken' in result) {
        setChallenge(result.challengeToken)
        setPassword('')
      }
    },
  })
  const second = useMutation({
    mutationFn: () => verifyCode(challenge ?? '', code.trim()),
    // a challenge that ran out (5 minutes) or was cancelled by a password change: back to the first step
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401 && /sign in again|took too long/i.test(error.message)) {
        setChallenge(null)
        setCode('')
      }
    },
  })
  const active = challenge ? second : login
  const fieldErrors = active.error instanceof ApiError ? active.error.fieldErrors : {}
  const generalError = active.error && Object.keys(fieldErrors).length === 0 ? errorMessage(active.error) : null

  // Signed in (just now, or already): always start on the person's own first page ("/" sends HR and administrators to the
  // dashboard and employees to their profile), after the steps that must come first: a new password, then two-factor setup.
  // Where the previous person (or an expired session) had been is deliberately not remembered.
  if (status === 'signedIn' && user) {
    const target = user.mustChangePassword ? '/change-password' : user.twoFactorSetupRequired ? '/security' : '/'
    return <Navigate to={target} replace />
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    clearNotice()
    if (challenge) second.mutate()
    else login.mutate()
  }

  function startOver() {
    setChallenge(null)
    setCode('')
    setRecovery(false)
    second.reset()
    login.reset()
  }

  return (
    <AuthShell
      title={challenge ? 'Two-factor sign-in' : 'Welcome back'}
      subtitle={challenge ? 'Enter the code from your authenticator app.' : 'Sign in to SmartHR to continue.'}
    >
      <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
        {notice && <ErrorMessage message={notice} />}
        {arrival?.error && !generalError && !notice && <ErrorMessage message={arrival.error} />}
        {generalError && <ErrorMessage message={generalError} />}

        {challenge ? (
          <>
            <TextField
              label={recovery ? 'Recovery code' : '6-digit code'}
              type="text"
              inputMode={recovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={fieldErrors.code}
              placeholder={recovery ? 'XXXXX-XXXXX' : '123456'}
              maxLength={recovery ? 20 : 7}
            />
            <Button type="submit" className="w-full" disabled={second.isPending || code.trim() === ''}>
              {second.isPending ? 'Checking…' : 'Verify and sign in'}
            </Button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <button
                type="button"
                className="text-brand-700 hover:underline"
                onClick={() => {
                  setRecovery((value) => !value)
                  setCode('')
                  second.reset()
                }}
              >
                {recovery ? 'Use the code from my app' : 'Use a recovery code'}
              </button>
              <button type="button" className="text-slate-500 hover:underline" onClick={startOver}>
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <TextField
              label="Username"
              type="email"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={fieldErrors.username}
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
            {providers.data?.google && (
              <>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  or
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <a
                  href={googleSignInUrl}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <GoogleLogo />
                  Continue with Google
                </a>
              </>
            )}
          </>
        )}
      </form>
      {!challenge && <p className="mt-4 text-center text-xs text-slate-500 lg:text-left">Forgot your password? Ask an administrator to reset it.</p>}
      {challenge && <p className="mt-4 text-center text-xs text-slate-500 lg:text-left">Lost your phone? Use a recovery code, or ask an administrator to reset two-factor sign-in.</p>}
    </AuthShell>
  )
}

/** Google's "G" in its own colours (a brand mark: it keeps them in dark mode too). */
function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}
