import { useEffect } from 'react'

/** Sets the browser tab title to "<title> · SmartHR" while the page is shown (history and bookmarks read better). */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · SmartHR` : 'SmartHR'
  }, [title])
}
