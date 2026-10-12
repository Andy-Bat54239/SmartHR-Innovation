import { createContext } from 'react'

export type ToastTone = 'success' | 'error'

export interface ToastApi {
  /** Shows a short message in the corner; it goes away by itself. */
  show: (message: string, tone?: ToastTone) => void
}

// The no-op default means a component used outside the provider (a test, say) simply shows nothing.
export const ToastContext = createContext<ToastApi>({ show: () => {} })
