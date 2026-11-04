export const PROFILE_ICONS = [
  { id: 'initials', label: 'Initials', symbol: '' },
  { id: 'cat', label: 'Cat', symbol: '🐱' },
  { id: 'dog', label: 'Dog', symbol: '🐶' },
  { id: 'panda', label: 'Panda', symbol: '🐼' },
  { id: 'fox', label: 'Fox', symbol: '🦊' },
  { id: 'coffee', label: 'Coffee', symbol: '☕' },
  { id: 'noodles', label: 'Noodles', symbol: '🍜' },
  { id: 'star', label: 'Star', symbol: '⭐' },
]

export const profileIcon = (id) => PROFILE_ICONS.find((icon) => icon.id === id) ?? PROFILE_ICONS[0]

export function validateProfile({ name, email, icon }) {
  if (name.trim().length > 60) return 'Use at most 60 characters for your name.'
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
  if (!PROFILE_ICONS.some((choice) => choice.id === icon)) return 'Choose a profile icon.'
  return null
}
