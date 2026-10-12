import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, errorMessage } from '../../api/client'
import { createLocation, updateLocation } from '../../api/locations'
import type { Location, LocationType } from '../../api/types'
import { Button } from '../../components/Button'
import { ErrorMessage } from '../../components/Feedback'
import { TextField } from '../../components/Fields'
import { useToast } from '../../hooks/useToast'
import { typeLabel } from '../../lib/location'

/** Either a new location of `type` under `parent` (null for a province), or an existing one being edited. */
export type LocationFormMode =
  | { kind: 'create'; type: LocationType; parent: Location | null }
  | { kind: 'edit'; location: Location }

interface LocationFormProps {
  mode: LocationFormMode
  onSaved: () => void
  onCancel: () => void
}

export function LocationForm({ mode, onSaved, onCancel }: LocationFormProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const existing = mode.kind === 'edit' ? mode.location : null
  const [name, setName] = useState(existing?.name ?? '')
  const [code, setCode] = useState(existing?.code ?? '')

  const type = mode.kind === 'create' ? mode.type : mode.location.type

  const save = useMutation({
    mutationFn: () => {
      const base = { name: name.trim(), type, code: code.trim() || null }
      return mode.kind === 'edit'
        ? updateLocation(mode.location.id, base)
        : createLocation({ ...base, parent: mode.parent ? { id: mode.parent.id } : null })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      toast(mode.kind === 'edit' ? `Saved ${name.trim()}` : `Added ${name.trim()}`)
      onSaved()
    },
  })

  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const generalError = save.error && Object.keys(fieldErrors).length === 0 ? errorMessage(save.error) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {mode.kind === 'create' && mode.parent && (
        <p className="text-sm text-slate-500">
          A new {typeLabel(type).toLowerCase()} inside <strong className="text-slate-700">{mode.parent.name}</strong>.
        </p>
      )}
      {generalError && <ErrorMessage message={generalError} />}
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} autoFocus />
      <TextField
        label="Code (optional)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={fieldErrors.code}
        placeholder={type === 'PROVINCE' ? 'e.g. KIG' : undefined}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : mode.kind === 'edit' ? 'Save changes' : `Add ${typeLabel(type).toLowerCase()}`}
        </Button>
      </div>
    </form>
  )
}
