import { useState } from 'react'

const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base' }

// soft background + dark text of the same hue: every pair is well above 4.5:1
const tints = [
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-900',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-teal-100 text-teal-800',
]

/** The same name always gets the same colour, so a person is recognisable across the page. */
function tintFor(name: string) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) % 997
  return tints[hash % tints.length]
}

interface AvatarProps {
  firstName: string
  lastName: string
  /** a picture, if the profile has one; anything that is not an http(s) address is ignored */
  photoUrl?: string | null
  size?: keyof typeof sizes
  className?: string
}

/** A round picture of a person, or their initials when there is none (or it cannot be loaded). */
export function Avatar({ firstName, lastName, photoUrl, size = 'md', className = '' }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const usable = photoUrl && /^https?:\/\//i.test(photoUrl) && photoUrl !== failedUrl ? photoUrl : null
  const base = `inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none ${sizes[size]} ${className}`

  if (usable) {
    return <img src={usable} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(usable)} className={`${base} object-cover`} />
  }
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  return (
    <span aria-hidden className={`${base} ${tintFor(`${firstName} ${lastName}`)}`}>
      {initials}
    </span>
  )
}
