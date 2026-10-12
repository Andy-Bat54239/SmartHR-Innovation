import { useCallback, useEffect, useRef, useState } from 'react'

/** What a person doing something looks like to the browser. */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

interface IdleTimeout {
  /** Seconds left before sign-out while the warning is showing, otherwise null. */
  secondsLeft: number | null
  /** The person said they are still there: start counting again. */
  stayActive: () => void
}

/**
 * Calls {@link onTimeout} after `idleMs` of no activity plus `warningMs` of warning. During the warning only
 * {@link IdleTimeout.stayActive} counts, so a bump of the mouse does not dismiss it by accident.
 *
 * It compares clock times once a second instead of trusting one long timer: browsers slow timers in background
 * tabs and a sleeping laptop stops them, and in both cases the person must still be signed out on time.
 */
export function useIdleTimeout(idleMs: number, warningMs: number, onTimeout: () => void): IdleTimeout {
  const lastActivity = useRef(0)
  const warning = useRef(false)
  const timedOut = useRef(false)
  const callback = useRef(onTimeout)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    callback.current = onTimeout
  }, [onTimeout])

  const stayActive = useCallback(() => {
    lastActivity.current = Date.now()
    warning.current = false
    setSecondsLeft(null)
  }, [])

  useEffect(() => {
    lastActivity.current = Date.now()
    warning.current = false
    timedOut.current = false

    const onActivity = () => {
      if (!warning.current) lastActivity.current = Date.now()
    }
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))

    const timer = window.setInterval(() => {
      if (timedOut.current) return
      const idle = Date.now() - lastActivity.current
      if (idle >= idleMs + warningMs) {
        timedOut.current = true
        setSecondsLeft(null)
        callback.current()
      } else if (idle >= idleMs) {
        warning.current = true
        setSecondsLeft(Math.ceil((idleMs + warningMs - idle) / 1000))
      }
    }, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity))
      window.clearInterval(timer)
    }
  }, [idleMs, warningMs])

  return { secondsLeft, stayActive }
}
