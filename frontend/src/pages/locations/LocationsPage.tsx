import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { deleteLocation, getLocation, listChildren, listProvinces } from '../../api/locations'
import type { Location } from '../../api/types'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadError, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { childType, locationChain, typeLabel } from '../../lib/location'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../hooks/useToast'
import { LocationForm } from './LocationForm'
import type { LocationFormMode } from './LocationForm'

/**
 * Browses Rwanda's location tree one level at a time:
 *   /locations        the provinces
 *   /locations/:id    the children of that location (districts of a province, sectors of a district, ...)
 */
export default function LocationsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const node = useQuery({ queryKey: ['locations', 'node', id], queryFn: () => getLocation(id!), enabled: Boolean(id) })
  const children = useQuery({
    queryKey: id ? ['locations', 'children', id] : ['locations', 'provinces'],
    queryFn: () => (id ? listChildren(id) : listProvinces()),
  })

  const [form, setForm] = useState<LocationFormMode | null>(null)
  const [deleting, setDeleting] = useState<Location | null>(null)

  const remove = useMutation({
    mutationFn: (location: Location) => deleteLocation(location.id),
    onSuccess: async (_data, location) => {
      // employees that lived there just lost their location
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['locations'] }),
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
      ])
      toast(`Deleted ${location.name}`)
      setDeleting(null)
      // deleted the place we are standing in: go up one level
      if (location.id === id) {
        navigate(location.parent ? `/locations/${location.parent.id}` : '/locations')
      }
    },
  })

  function closeDelete() {
    setDeleting(null)
    remove.reset()
  }

  const current = id ? node.data : undefined
  useDocumentTitle(current ? current.name : 'Locations')
  // On /locations new records are provinces. On /locations/:id they depend on the place being viewed,
  // so nothing can be added until that place has loaded (otherwise a "New province" button would flash up).
  const nextType = id ? (current ? childType(current.type) : null) : 'PROVINCE'
  const rows = [...(children.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  if (id && node.isError) {
    return (
      <div>
        <LoadError message={errorMessage(node.error)} onRetry={() => node.refetch()} />
        <Link to="/locations" className="text-sm text-brand-600 hover:underline">
          Back to all provinces
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* breadcrumb: Locations › Kigali City › Gasabo */}
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
        {current ? (
          <Link to="/locations" className="hover:text-brand-600 hover:underline">
            Locations
          </Link>
        ) : (
          <span className="font-medium text-slate-700">Locations</span>
        )}
        {current &&
          locationChain(current).map((place) => (
            <span key={place.id} className="flex items-center gap-1.5">
              <span aria-hidden>›</span>
              {place.id === current.id ? (
                <span className="font-medium text-slate-700">{place.name}</span>
              ) : (
                <Link to={`/locations/${place.id}`} className="hover:text-brand-600 hover:underline">
                  {place.name}
                </Link>
              )}
            </span>
          ))}
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{current ? current.name : 'Locations'}</h1>
          <p className="text-sm text-slate-500">
            {current
              ? `${typeLabel(current.type)}${current.code ? ` · code ${current.code}` : ''}${nextType ? '' : ' · lowest level'}`
              : 'Provinces, districts, sectors, cells and villages.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {current && (
            <>
              <Button variant="secondary" onClick={() => setForm({ kind: 'edit', location: current })}>
                Edit
              </Button>
              <Button variant="secondary" className="text-red-700" onClick={() => setDeleting(current)}>
                Delete
              </Button>
            </>
          )}
          {nextType && (
            <Button onClick={() => setForm({ kind: 'create', type: nextType, parent: current ?? null })}>
              {current ? `Add ${typeLabel(nextType).toLowerCase()}` : 'New province'}
            </Button>
          )}
        </div>
      </div>

      {(children.isPending || (id && node.isPending)) && <Loading />}
      {children.isError && <LoadError message={errorMessage(children.error)} onRetry={() => children.refetch()} />}

      {children.isSuccess && nextType && (
        <>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            {typeLabel(nextType)}s{rows.length > 0 && ` (${rows.length})`}
          </h2>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              No {typeLabel(nextType).toLowerCase()}s yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
                <caption className="sr-only">{typeLabel(nextType)}s</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Name</th>
                    <th scope="col" className="px-4 py-3">Code</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((place) => (
                    <tr key={place.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">
                        {childType(place.type) ? (
                          <Link to={`/locations/${place.id}`} className="text-brand-700 hover:underline">
                            {place.name}
                          </Link>
                        ) : (
                          place.name
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {place.code ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{place.code}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {childType(place.type) && (
                            <Link
                              to={`/locations/${place.id}`}
                              className="inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50"
                            >
                              Open
                            </Link>
                          )}
                          <Button variant="secondary" className="px-2.5 py-1" onClick={() => setForm({ kind: 'edit', location: place })}>
                            Edit
                          </Button>
                          <Button variant="secondary" className="px-2.5 py-1 text-red-700" onClick={() => setDeleting(place)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal
        open={form !== null}
        title={form?.kind === 'edit' ? `Edit ${typeLabel(form.location.type).toLowerCase()}` : `New ${form ? typeLabel(form.type).toLowerCase() : ''}`}
        onClose={() => setForm(null)}
      >
        {form && <LocationForm mode={form} onSaved={() => setForm(null)} onCancel={() => setForm(null)} />}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${typeLabel(deleting.type).toLowerCase()}` : 'Delete'}
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onCancel={closeDelete}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        Delete <strong className="text-slate-900">{deleting?.name}</strong>
        {deleting && childType(deleting.type) ? ' and everything inside it' : ''}? Employees located there are kept, but lose their location.
      </ConfirmDialog>
    </div>
  )
}
