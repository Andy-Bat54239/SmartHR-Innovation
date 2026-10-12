import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const styles: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-brand-600',
  danger: 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
