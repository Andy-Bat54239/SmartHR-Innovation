import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  /** 'lg' for long forms */
  size?: 'md' | 'lg'
  children: ReactNode
}

/**
 * A modal built on the native <dialog>: focus is trapped, Esc closes it and the page behind is inert.
 * Children are only rendered while it is open, so a form inside always starts from a clean state.
 */
export function Modal({ open, title, onClose, size = 'md', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // The browser reports a close (Esc, or our own dialog.close()) a moment after it happened. If the dialog
      // has been opened again by then, this is a leftover event and must not close the new one.
      onClose={() => {
        if (!ref.current?.open) onClose()
      }}
      // a click on the backdrop lands on the <dialog> element itself, not on the panel inside it
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl bg-white p-0 shadow-xl ${
        size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
      }`}
    >
      {open && (
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  )
}
