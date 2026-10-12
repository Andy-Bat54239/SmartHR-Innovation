import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, errorMessage } from '../../api/client'
import { createTraining, updateTraining } from '../../api/trainings'
import type { Training } from '../../api/types'
import { Button } from '../../components/Button'
import { ErrorMessage } from '../../components/Feedback'
import { TextAreaField, TextField } from '../../components/Fields'
import { useToast } from '../../hooks/useToast'

interface TrainingFormProps {
  /** the training being edited, or undefined to create a new one */
  initial?: Training
  onSaved: () => void
  onCancel: () => void
}

export function TrainingForm({ initial, onSaved, onCancel }: TrainingFormProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [trainer, setTrainer] = useState(initial?.trainer ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  const save = useMutation({
    mutationFn: () => {
      const input = {
        title: title.trim(),
        trainer: trainer.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        description: description.trim() || null,
      }
      return initial ? updateTraining(initial.id, input) : createTraining(input)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trainings'] })
      toast(initial ? 'Training saved' : 'Training created')
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
      {generalError && <ErrorMessage message={generalError} />}
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={fieldErrors.title} autoFocus />
      <TextField label="Trainer (optional)" value={trainer} onChange={(e) => setTrainer(e.target.value)} error={fieldErrors.trainer} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Start date (optional)" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={fieldErrors.startDate} />
        <TextField
          label="End date (optional)"
          type="date"
          min={startDate || undefined}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          error={fieldErrors.endDate}
        />
      </div>
      <TextAreaField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} error={fieldErrors.description} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Create training'}
        </Button>
      </div>
    </form>
  )
}
