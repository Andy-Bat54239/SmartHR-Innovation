import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeGoogleCode, isChallenge } from '../../api/auth'
import { errorMessage } from '../../api/client'
import { Loading } from '../../components/Feedback'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

/**
 * Where Google sign-in lands: the server sends the browser here with a one-time `code` (or an `error` in plain words).
 * The code is swapped for the usual login with one request. An account with two-factor sign-in continues on the login
 * page at the code step; anything that went wrong goes back to the login page with the reason.
 */
export default function GoogleCallbackPage() {
  useDocumentTitle('Signing in with Google')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { completeLogin } = useAuth()
  // a code works once, and React runs effects twice in development: only the first call may use it
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const error = params.get('error')
    const code = params.get('code')
    // take the code out of the address bar and the history straight away
    window.history.replaceState(null, '', '/auth/google/callback')
    if (error || !code) {
      navigate('/login', { replace: true, state: { error: error ?? 'Google sign-in did not finish. Try again.' } })
      return
    }
    exchangeGoogleCode(code)
      .then((response) => {
        if (isChallenge(response)) {
          navigate('/login', { replace: true, state: { challengeToken: response.challengeToken } })
        } else {
          completeLogin(response)
          navigate('/', { replace: true })
        }
      })
      .catch((e: unknown) => navigate('/login', { replace: true, state: { error: errorMessage(e) } }))
  }, [params, navigate, completeLogin])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loading label="Signing you in with Google…" />
    </div>
  )
}
