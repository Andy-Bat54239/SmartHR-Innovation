import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface BellMenuProps {
  /** what a screen reader announces for the button, also its tooltip */
  label: string
  /** the red number on the bell; 0 hides it */
  count: number
  /** the title of the dropdown */
  title: string
  /** small badge next to the title (for example "3 waiting") */
  headerBadge?: ReactNode
  /** rendered under the content, usually a link */
  footer?: (close: () => void) => ReactNode
  /** called each time the dropdown opens */
  onOpen?: () => void
  children: (close: () => void) => ReactNode
}

/** The bell button and its dropdown shell: closes on a click elsewhere or Escape, full width on a phone. */
export function BellMenu({ label, count, title, headerBadge, footer, onOpen, children }: BellMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls="notification-menu"
        onClick={() => {
          if (!open) onOpen?.()
          setOpen((value) => !value)
        }}
        className="relative rounded-full p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.75} />
        {count > 0 && (
          <span aria-hidden className="absolute top-1 right-0.5 min-w-4.5 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4.5 font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-menu"
          className="fixed top-16 right-3 left-3 z-40 rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {headerBadge}
          </div>
          {children(close)}
          {footer?.(close)}
        </div>
      )}
    </div>
  )
}
