import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { createDepartment, updateDepartment } from '../../api/departments'
import { ApiError, errorMessage } from '../../api/client'
import type { Department } from '../../api/types'
import { Button } from '../../components/Button'
import { TextAreaField, TextField } from '../../components/Fields'
import { ErrorMessage } from '../../components/Feedback'
import { useToast } from '../../hooks/useToast'

interface DepartmentFormProps {
  /** the department being edited, or undefined to create a new one */
  initial?: Department
  onSaved: () => void
  onCancel: () => void
}

export function DepartmentForm({ initial, onSaved, onCancel }: DepartmentFormProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  const save = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), code: code.trim(), description: description.trim() || null }
      return initial ? updateDepartment(initial.id, input) : createDepartment(input)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast(initial ? 'Department saved' : 'Department created')
      onSaved()
    },
  })

  // 400 validation errors arrive per field; anything else (409 duplicate, network...) is one message
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const generalError = save.error && Object.keys(fieldErrors).length === 0 ? errorMessage(save.error) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  // noValidate: the API is the single source of truth for the rules, so its messages are shown
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {generalError && <ErrorMessage message={generalError} />}
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} autoFocus />
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} error={fieldErrors.code} placeholder="e.g. HR" />
      <TextAreaField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={fieldErrors.description}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Create department'}
        </Button>
      </div>
    </form>
  )
}
