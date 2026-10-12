import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loading } from '../components/Feedback'
import { IdleTimeout } from '../components/IdleTimeout'
import { useAuth } from '../hooks/useAuth'

/**
 * Everything below it needs a login. Not signed in: go to the login page.
 * Signed in with a password an administrator set: go and choose a new one first.
 * A role that must use two-factor sign-in but has not set it up: go to the security page first.
 */
export function RequireAuth() {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="Checking your session…" />
      </div>
    )
  }
  if (status === 'signedOut' || !user) {
    return <Navigate to="/login" replace />
  }
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  // the password comes first: an administrator with a temporary password has both to do, and each redirect must not undo the other
  if (!user.mustChangePassword && user.twoFactorSetupRequired && location.pathname !== '/security') {
    return <Navigate to="/security" replace />
  }
  return (
    <>
      <Outlet />
      <IdleTimeout />
    </>
  )
}
