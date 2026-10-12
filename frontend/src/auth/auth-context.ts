import { createContext } from 'react'
import type { LoginResponse, Role, UserAccount } from '../api/types'

export interface AuthState {
  /** 'loading' while a stored token is being checked against the API on page load */
  status: 'loading' | 'signedIn' | 'signedOut'
  user: UserAccount | null
  /** why the person was signed out ("Your session has expired"), shown once on the login page */
  notice: string | null
  /** Step one. Answers with the person, or, for an account with two-factor sign-in, the challenge to finish with {@link verifyCode}. */
  signIn: (username: string, password: string) => Promise<{ user: UserAccount } | { challengeToken: string }>
  /** Step two of two-factor sign-in. */
  verifyCode: (challengeToken: string, code: string) => Promise<UserAccount>
  /** Replaces the signed-in account with a newer copy (after changing a setting). */
  updateUser: (user: UserAccount) => void
  /** Takes over a login response (after a password change): stores the token and the account. */
  completeLogin: (response: LoginResponse) => void
  signOut: () => void
  /** Ends the session because of something that happened (inactivity), and shows the reason on the login page. */
  expire: (reason: string) => void
  clearNotice: () => void
  hasRole: (...roles: Role[]) => boolean
}

export const AuthContext = createContext<AuthState | null>(null)
