import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Table state (page, size, sort, filters) lives in the URL, so a refresh, the back button or a copied link
 * all show the same view. `update` changes some parameters: an empty value removes the parameter, and
 * anything but a page change goes back to page 1. It uses `replace`, so filter clicks do not fill the history.
 */
export function useUrlParams() {
  const [params, setParams] = useSearchParams()

  const update = useCallback(
    (changes: Record<string, string | undefined>, keepPage = false) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          if (!keepPage && !('page' in changes)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { params, update }
}

/** A whole number >= 0 from the URL, or the fallback. */
export function wholeNumber(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key)
  const n = Number(raw)
  return raw !== null && Number.isInteger(n) && n >= 0 ? n : fallback
}

/** The URL value if it is one of the allowed ones, otherwise undefined. */
export function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value)
}

type Update = ReturnType<typeof useUrlParams>['update']

/**
 * After the last row of the last page is deleted (or the URL names a page that does not exist), step back to
 * the last real page. Pass `undefined` while the answer is still a placeholder from the previous query.
 */
export function useKeepPageInRange(totalPages: number | undefined, currentPage: number, update: Update) {
  useEffect(() => {
    if (totalPages === undefined) return
    if (totalPages === 0 && currentPage > 0) update({ page: undefined }, true)
    else if (totalPages > 0 && currentPage >= totalPages) update({ page: String(totalPages - 1) }, true)
  }, [totalPages, currentPage, update])
}
