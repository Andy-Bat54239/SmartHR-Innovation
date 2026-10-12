import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Column heading text without the sort arrows. */
const headingText = (th: Element) => (th.textContent ?? '').replace(/[↑↓]/g, '').trim()

function label(table: HTMLTableElement) {
  const headings = Array.from(table.querySelectorAll('thead th')).map(headingText)
  table.querySelectorAll('tbody tr').forEach((row) => {
    const cells = Array.from(row.children)
    // a single wide cell (an empty or error message) has nothing to label
    if (cells.length !== headings.length) return
    cells.forEach((cell, index) => {
      if (cell.getAttribute('data-label') !== headings[index]) cell.setAttribute('data-label', headings[index])
    })
  })
}

/**
 * Gives every cell of a `table.stack-table` inside `root` a data-label with its column heading, so the phone layout
 * in index.css can print "Heading  value" on each line. Rows that load later, or a page that changes, are picked up.
 */
export function useStackedTables(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current
    if (!element) return
    const run = () => element.querySelectorAll<HTMLTableElement>('table.stack-table').forEach(label)
    run()
    let frame = 0
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(run)
    })
    observer.observe(element, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [root])
}
