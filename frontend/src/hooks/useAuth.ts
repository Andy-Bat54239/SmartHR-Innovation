import { useContext } from 'react'
import { AuthContext } from '../auth/auth-context'

/** Who is signed in: `const { user, hasRole, signOut } = useAuth()`. */
export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}
