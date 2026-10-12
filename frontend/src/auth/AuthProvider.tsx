import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { isChallenge, login, loginWithCode } from '../api/auth'
import { setAuthHandlers } from '../api/client'
import { getMe } from '../api/me'
import type { LoginResponse, Role, UserAccount } from '../api/types'
import { AuthContext } from './auth-context'
import type { AuthState } from './auth-context'
import { clearToken, getToken, setToken } from './tokenStore'

/** Knows who is signed in. Wrap the app once, inside the query client. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthState['status']>(() => (getToken() ? 'loading' : 'signedOut'))
  const [user, setUser] = useState<UserAccount | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const endSession = useCallback(
    (reason: string | null) => {
      clearToken()
      setUser(null)
      setStatus('signedOut')
      setNotice(reason)
      // data fetched for one person must never be shown to the next one
      queryClient.clear()
    },
    [queryClient],
  )

  // a token left in this tab by a refresh: is it still good, and whose is it?
  useEffect(() => {
    if (status !== 'loading') return
    let cancelled = false
    getMe()
      .then((me) => {
        if (cancelled) return
        setUser(me.user)
        setStatus('signedIn')
      })
      .catch(() => {
        if (!cancelled) endSession(null)
      })
    return () => {
      cancelled = true
    }
  }, [status, endSession])

  // the API calls these from its error handling (see api/client.ts)
  useEffect(() => {
    setAuthHandlers({
      unauthorized: () => endSession('Your session has expired. Sign in again.'),
      passwordChangeRequired: () => setUser((current) => (current ? { ...current, mustChangePassword: true } : current)),
      twoFactorSetupRequired: () => setUser((current) => (current ? { ...current, twoFactorSetupRequired: true } : current)),
    })
  }, [endSession])

  const completeLogin = useCallback((response: LoginResponse) => {
    setToken(response.token)
    setUser(response.user)
    setStatus('signedIn')
    setNotice(null)
  }, [])

  const signIn = useCallback(
    async (username: string, password: string) => {
      const response = await login(username, password)
      if (isChallenge(response)) return { challengeToken: response.challengeToken }
      queryClient.clear()
      completeLogin(response)
      return { user: response.user }
    },
    [queryClient, completeLogin],
  )

  const verifyCode = useCallback(
    async (challengeToken: string, code: string) => {
      const response = await loginWithCode(challengeToken, code)
      queryClient.clear()
      completeLogin(response)
      return response.user
    },
    [queryClient, completeLogin],
  )

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      notice,
      signIn,
      verifyCode,
      updateUser: setUser,
      completeLogin,
      signOut: () => endSession(null),
      expire: (reason: string) => endSession(reason),
      clearNotice: () => setNotice(null),
      hasRole: (...roles: Role[]) => user !== null && roles.includes(user.role),
    }),
    [status, user, notice, signIn, verifyCode, completeLogin, endSession],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
