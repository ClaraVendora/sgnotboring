import { useEffect, useState } from 'react'
import { Button, HStack, Input } from '@chakra-ui/react'

// Synchronize external URL changes without remounting the focused input.
export default function PlaceSearch({ value, onChange }) {
  const [draft, setDraft] = useState(value)
  const [previousValue, setPreviousValue] = useState(value)
  if (value !== previousValue) {
    setPreviousValue(value)
    setDraft(value)
  }
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), 300)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])

  return (
    <HStack as="form" onSubmit={(event) => { event.preventDefault(); onChange(draft) }}>
      <Input
        type="search"
        placeholder="Search by name or area"
        aria-label="Search by name or area"
        value={draft}
        maxLength={100}
        onChange={(event) => setDraft(event.target.value)}
      />
      {(draft || value) && (
        <Button type="button" variant="ghost" onClick={() => { setDraft(''); onChange('') }}>
          Clear search
        </Button>
      )}
    </HStack>
  )
}
