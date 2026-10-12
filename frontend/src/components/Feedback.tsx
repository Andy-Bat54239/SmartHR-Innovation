import { Button } from './Button'

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-sm text-slate-500">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  )
}

/** A failed load, with a retry button. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3 py-6">
      <ErrorMessage message={message} />
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
