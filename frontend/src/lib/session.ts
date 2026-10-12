/** Minutes without any activity (mouse, keyboard, touch, scroll) before the warning appears. Change it in .env.local. */
const idleMinutes = Number(import.meta.env.VITE_IDLE_MINUTES)
export const IDLE_MINUTES = Number.isFinite(idleMinutes) && idleMinutes > 0 ? idleMinutes : 20

/** Seconds the warning stays up, counting down, before the person is signed out. */
const warningSeconds = Number(import.meta.env.VITE_IDLE_WARNING_SECONDS)
export const IDLE_WARNING_SECONDS = Number.isFinite(warningSeconds) && warningSeconds > 0 ? warningSeconds : 60
