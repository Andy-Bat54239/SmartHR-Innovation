import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from '../lib/toast-context'
import type { ToastTone } from '../lib/toast-context'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const VISIBLE_FOR_MS: Record<ToastTone, number> = { success: 4000, error: 7000 }
const MAX_ON_SCREEN = 3

/** Wrap the app once. Anything below it can call `useToast()`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-(MAX_ON_SCREEN - 1)), { id, message, tone }])
      setTimeout(() => dismiss(id), VISIBLE_FOR_MS[tone])
    },
    [dismiss],
  )

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext value={api}>
      {children}
      {/* one live region for the whole app, so screen readers announce each message as it appears */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white p-3 pr-2 text-sm shadow-lg ${
              toast.tone === 'success' ? 'border-emerald-200' : 'border-red-200'
            }`}
          >
            <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${toast.tone === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {toast.tone === 'success' ? '✓' : '!'}
            </span>
            <p className="min-w-0 flex-1 pt-0.5 text-slate-800">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss message"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}
