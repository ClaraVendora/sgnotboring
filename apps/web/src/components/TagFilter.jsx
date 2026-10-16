import { Button, HStack } from '@chakra-ui/react'

// Pills for every known tag, in one horizontally scrollable row (there are ~60 tags, so
// wrapping would push the cards off a phone screen). `selected` is the list in the URL.
export default function TagFilter({ tags, selected, onToggle, onClear }) {
  return (
    <HStack gap={2} overflowX="auto" mx={-4} px={4} pb={1} css={{ scrollbarWidth: 'none' }}>
      {selected.length > 0 && (
        <Button size="sm" rounded="full" variant="ghost" flexShrink={0} onClick={onClear}>
          Clear
        </Button>
      )}
      {tags.map((tag) => {
        const active = selected.includes(tag)
        return (
          <Button
            key={tag}
            size="sm"
            rounded="full"
            flexShrink={0}
            variant={active ? 'solid' : 'outline'}
            colorPalette={active ? 'teal' : 'gray'}
            onClick={() => onToggle(tag)}
          >
            {tag}
          </Button>
        )
      })}
    </HStack>
  )
}
