import { Button, Wrap } from '@chakra-ui/react'

// Pills for every known tag. `selected` is the list currently in the URL.
export default function TagFilter({ tags, selected, onToggle, onClear }) {
  return (
    <Wrap gap={2}>
      {tags.map((tag) => {
        const active = selected.includes(tag)
        return (
          <Button
            key={tag}
            size="sm"
            rounded="full"
            variant={active ? 'solid' : 'outline'}
            colorPalette={active ? 'teal' : 'gray'}
            onClick={() => onToggle(tag)}
          >
            {tag}
          </Button>
        )
      })}
      {selected.length > 0 && (
        <Button size="sm" rounded="full" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      )}
    </Wrap>
  )
}
