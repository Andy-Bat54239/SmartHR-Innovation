import { useEffect, useRef, useState } from 'react'

/**
 * A text box whose value lives in the URL. Typing updates the URL 300 ms after the last key (so a request is not
 * sent per letter), and the box follows the URL when something else changes it (back button, "Clear filters").
 */
export function useUrlSearchBox(current: string | undefined, apply: (value: string | undefined) => void, delayMs = 300) {
  const [text, setText] = useState(current ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Adjusting state while rendering, when the value it derives from changed, is React's pattern for this.
  const [seen, setSeen] = useState(current)
  if (current !== seen) {
    setSeen(current)
    if (text.trim() !== (current ?? '')) setText(current ?? '')
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  function onChange(value: string) {
    setText(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => apply(value.trim() || undefined), delayMs)
  }

  /** Call before clearing the URL yourself, so a pending keystroke cannot bring the old text back. */
  function reset() {
    clearTimeout(timer.current)
    setText('')
  }

  return { text, onChange, reset }
}
