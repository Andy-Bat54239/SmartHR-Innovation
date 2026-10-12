import { useAuth } from '../hooks/useAuth'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { IDLE_MINUTES, IDLE_WARNING_SECONDS } from '../lib/session'
import { Button } from './Button'
import { Modal } from './Modal'

/**
 * Signs the person out after {@link IDLE_MINUTES} minutes without activity, with a warning (and a countdown) for the
 * last {@link IDLE_WARNING_SECONDS} seconds. Shown only while someone is signed in. The API itself does not watch for
 * inactivity: its tokens simply expire after a fixed time (see `smarthr.security.token-ttl`).
 */
export function IdleTimeout() {
  const { expire, signOut } = useAuth()
  const { secondsLeft, stayActive } = useIdleTimeout(IDLE_MINUTES * 60_000, IDLE_WARNING_SECONDS * 1000, () =>
    expire(`You were signed out after ${IDLE_MINUTES} minutes of inactivity. Sign in again to continue.`),
  )

  return (
    <Modal open={secondsLeft !== null} title="Are you still there?" onClose={stayActive}>
      <div role="alertdialog" aria-live="assertive" className="space-y-4">
        <p className="text-sm text-slate-600">
          You have not done anything for {IDLE_MINUTES} minutes. To keep your account safe you will be signed out in{' '}
          <strong className="text-slate-900 tabular-nums">
            {secondsLeft ?? 0} {secondsLeft === 1 ? 'second' : 'seconds'}
          </strong>
          .
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => signOut()}>
            Sign out now
          </Button>
          <Button onClick={stayActive} autoFocus>
            Stay signed in
          </Button>
        </div>
      </div>
    </Modal>
  )
}
