import axios from 'axios'
import { getToken } from '../auth/tokenStore'
import type { ApiErrorBody } from './types'

const baseURL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8082'

/**
 * Every failed request is turned into an ApiError, so components only ever deal with one error type:
 *  - status       HTTP status, or 0 when the server could not be reached
 *  - message      human readable text from the API
 *  - fieldErrors  { fieldName: message } when the problem belongs to one input, empty otherwise
 *  - code         a machine-readable reason, e.g. PASSWORD_CHANGE_REQUIRED
 */
export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string>
  code?: string

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.code = code
  }
}

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// What to do when the API says "you are not signed in" / "choose a new password". The auth provider sets these.
let onUnauthorized: () => void = () => {}
let onPasswordChangeRequired: () => void = () => {}
let onTwoFactorSetupRequired: () => void = () => {}

export function setAuthHandlers(handlers: { unauthorized: () => void; passwordChangeRequired: () => void; twoFactorSetupRequired: () => void }) {
  onUnauthorized = handlers.unauthorized
  onPasswordChangeRequired = handlers.passwordChangeRequired
  onTwoFactorSetupRequired = handlers.twoFactorSetupRequired
}

// every request carries the token, if there is one
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError<Partial<ApiErrorBody>>(error)) {
      return Promise.reject(error)
    }
    if (error.response) {
      const { status, data } = error.response
      // A 401 on a login request (password or two-factor code) just means a wrong answer; anywhere else it means the session is over.
      if (status === 401 && !error.config?.url?.startsWith('/auth/login')) onUnauthorized()
      if (status === 403 && data?.code === 'PASSWORD_CHANGE_REQUIRED') onPasswordChangeRequired()
      if (status === 403 && data?.code === 'TWO_FACTOR_SETUP_REQUIRED') onTwoFactorSetupRequired()
      return Promise.reject(new ApiError(status, data?.message ?? error.message, data?.errors ?? {}, data?.code))
    }
    return Promise.reject(new ApiError(0, `Cannot reach the server at ${baseURL}. Is the API running?`))
  },
)

/** Best message to show for anything thrown by a request. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}
