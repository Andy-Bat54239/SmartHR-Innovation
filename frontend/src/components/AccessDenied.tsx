import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/** Shown where a signed-in person has no right to be. */
export function AccessDenied() {
  useDocumentTitle('No access')
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">You do not have access to this page</h1>
      <p className="mt-2 text-sm text-slate-500">Your account's role does not include it. Ask an administrator if you think it should.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        Back to the start
      </Link>
    </div>
  )
}
