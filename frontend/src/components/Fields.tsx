import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const inputStyles =
  'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-400'

function ringFor(error?: string) {
  return error ? 'ring-red-400' : 'ring-slate-300'
}

function FieldShell({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

interface FieldProps {
  label: string
  /** message for this field, straight from the API's `errors` object */
  error?: string
}

export function TextField({ label, error, className = '', ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputStyles} ${ringFor(error)} ${className}`}
        {...props}
      />
    </FieldShell>
  )
}

export function TextAreaField({ label, error, className = '', ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputStyles} ${ringFor(error)} ${className}`}
        {...props}
      />
    </FieldShell>
  )
}

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps extends FieldProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[]
  /** text of the empty choice ("" value); omit to have no empty choice */
  placeholder?: string
}

export function SelectField({ label, error, options, placeholder, className = '', ...props }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputStyles} ${ringFor(error)} ${className}`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
