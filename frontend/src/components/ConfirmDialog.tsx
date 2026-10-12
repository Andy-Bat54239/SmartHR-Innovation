import type { ReactNode } from 'react'
import { Button } from './Button'
import { ErrorMessage } from './Feedback'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** what will happen, shown above the buttons */
  children: ReactNode
  confirmLabel?: string
  /** 'danger' (red) for deleting, 'primary' for a harmless confirmation such as approving */
  tone?: 'danger' | 'primary'
  pending?: boolean
  /** message of a failed attempt, shown inside the dialog so the user can retry or cancel */
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

/** "Are you sure?" for actions that cannot be undone. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Delete',
  tone = 'danger',
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="space-y-4">
        <div className="text-sm text-slate-600">{children}</div>
        {error && <ErrorMessage message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
