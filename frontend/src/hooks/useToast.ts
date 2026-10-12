import { useContext } from 'react'
import { ToastContext } from '../lib/toast-context'

/** `const toast = useToast()` then `toast('Department created')`. */
export function useToast() {
  return useContext(ToastContext).show
}
