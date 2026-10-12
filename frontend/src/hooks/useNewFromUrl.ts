import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * True when the page was opened with `?new=1` (the dashboard's quick actions), so it can start with its "new ..." form open.
 * The answer is read once, and the parameter is then removed from the address so a refresh does not open the form again.
 */
export function useNewFromUrl(): boolean {
  const [params, setParams] = useSearchParams()
  const [wanted] = useState(() => params.get('new') === '1')

  useEffect(() => {
    if (params.get('new') !== '1') return
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('new')
        return next
      },
      { replace: true },
    )
  }, [params, setParams])

  return wanted
}
