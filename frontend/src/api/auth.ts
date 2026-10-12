import { api } from './client'
import type { LoginResponse, TwoFactorChallenge, TwoFactorSetup, TwoFactorStatus } from './types'

/** Step one. An account with two-factor sign-in gets a challenge instead of a login. */
export const login = (username: string, password: string) =>
  api.post<LoginResponse | TwoFactorChallenge>('/auth/login', { username, password }).then((r) => r.data)

export const isChallenge = (response: LoginResponse | TwoFactorChallenge): response is TwoFactorChallenge =>
  'twoFactorRequired' in response && response.twoFactorRequired === true

/** Step two: the challenge and a code from the app (or a recovery code). */
export const loginWithCode = (challengeToken: string, code: string) =>
  api.post<LoginResponse>('/auth/login/2fa', { challengeToken, code }).then((r) => r.data)

/** Every earlier token stops working, so the answer carries a fresh one. */
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post<LoginResponse>('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data)

/** Ends every login of the account on every device, this one included. */
export const signOutEverywhere = () => api.post('/auth/sign-out-everywhere').then(() => undefined)

export const getTwoFactorStatus = () => api.get<TwoFactorStatus>('/auth/2fa').then((r) => r.data)

/** Makes a new secret. Sign-in does not change until the first code is confirmed with `enableTwoFactor`. */
export const beginTwoFactorSetup = () => api.post<TwoFactorSetup>('/auth/2fa/setup').then((r) => r.data)

/** The recovery codes in the answer are shown this once. */
export const enableTwoFactor = (code: string) =>
  api.post<{ recoveryCodes: string[] }>('/auth/2fa/enable', { code }).then((r) => r.data.recoveryCodes)

export const disableTwoFactor = (password: string, code: string) => api.post('/auth/2fa/disable', { password, code }).then(() => undefined)

export const newRecoveryCodes = (password: string, code: string) =>
  api.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { password, code }).then((r) => r.data.recoveryCodes)

/** Which extra ways to sign in the server offers (public), so the login page knows which buttons to show. */
export const getSignInProviders = () => api.get<{ google: boolean }>('/auth/providers').then((r) => r.data)

/** Where the "Continue with Google" button sends the browser: the API starts the OAuth2 flow and Google takes over. */
export const googleSignInUrl = `${api.defaults.baseURL}/oauth2/authorization/google`

/** The last step of Google sign-in: the one-time code from the redirect for the usual login (or a two-factor challenge). */
export const exchangeGoogleCode = (code: string) =>
  api.post<LoginResponse | TwoFactorChallenge>('/auth/google/exchange', { code }).then((r) => r.data)
