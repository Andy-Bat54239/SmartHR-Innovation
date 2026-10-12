// The login token lives in sessionStorage: it survives a page refresh but is gone when the tab is closed,
// which suits a system full of personal data. Storage can be blocked (private modes, policies), so every
// access is guarded and the app then simply asks for a login again after each refresh.
const KEY = 'smarthr.token'

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token)
  } catch {
    /* kept only in memory of this page load is not possible here; the next refresh will ask for a login */
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
