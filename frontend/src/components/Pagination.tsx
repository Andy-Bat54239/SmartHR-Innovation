import { PAGE_SIZES } from '../lib/paging'
import { Button } from './Button'

interface PaginationProps {
  /** the page sizes offered; the table's own default is always one of them */
  sizes?: readonly number[]
  /** zero-based, as the API counts pages */
  page: number
  size: number
  totalPages: number
  totalElements: number
  onPage: (page: number) => void
  onSize: (size: number) => void
}

export function Pagination({ sizes = PAGE_SIZES, page, size, totalPages, totalElements, onPage, onSize }: PaginationProps) {
  const first = totalElements === 0 ? 0 : page * size + 1
  const last = Math.min((page + 1) * size, totalElements)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-sm text-slate-600">
      <p>
        {totalElements === 0 ? 'No results' : `Showing ${first}–${last} of ${totalElements}`}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2">
          Rows
          <select
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="rounded-lg border-0 py-1.5 pr-8 pl-2 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            {sizes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" className="px-2.5 py-1.5" disabled={page <= 0} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="whitespace-nowrap tabular-nums">
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
        </span>
        <Button variant="secondary" className="px-2.5 py-1.5" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}
