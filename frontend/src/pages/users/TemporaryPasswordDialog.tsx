import { useState } from 'react'
import type { AccountCreated } from '../../api/types'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'

interface TemporaryPasswordDialogProps {
  /** the account and its generated password, or null when the dialog is closed */
  result: AccountCreated | null
  /** one line before the password: "Account created for…" / "Password reset for…" */
  heading: string
  onClose: () => void
}

/**
 * The generated password is shown here once and never again (the server keeps only a hash of it),
 * so it has to be copied or passed on before this is closed.
 */
export function TemporaryPasswordDialog({ result, heading, onClose }: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.temporaryPassword)
      setCopied(true)
    } catch {
      // clipboard blocked: the password is selectable on screen instead
      setCopied(false)
    }
  }

  return (
    <Modal open={result !== null} title="Temporary password" onClose={onClose}>
      {result && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {heading} <strong className="text-slate-900">{result.user.username}</strong>.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <code className="text-lg font-semibold tracking-wider text-slate-900 select-all">{result.temporaryPassword}</code>
            <Button variant="secondary" className="shrink-0 px-2.5 py-1" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This is the only time it is shown. Pass it to the person now. They will be asked to choose their own password when they sign in.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
