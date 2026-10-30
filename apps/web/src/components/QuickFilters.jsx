import { Button, HStack } from '@chakra-ui/react'
import { QUICK_FILTERS } from '../lib/place-filters.js'

export default function QuickFilters({ selected, openNow, onToggleTag, onToggleOpenNow }) {
  return (
    <HStack gap={2} flexWrap="wrap" aria-label="Quick filters">
      {QUICK_FILTERS.map(({ label, tag }) => {
        const active = tag ? selected.includes(tag) : openNow
        return <Button key={label} type="button" size="sm" rounded="full" aria-pressed={active}
          colorPalette={active ? 'blue' : 'gray'} variant={active ? 'solid' : 'outline'}
          onClick={() => tag ? onToggleTag(tag) : onToggleOpenNow()}>{label}</Button>
      })}
    </HStack>
  )
}
