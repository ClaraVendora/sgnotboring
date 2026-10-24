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
            aria-pressed={active}
            size="sm"
            rounded="full"
            flexShrink={0}
            variant={active ? 'solid' : 'outline'}
            colorPalette={active ? 'blue' : 'gray'}
            bg={active ? 'blue.solid' : 'bg.panel'}
            borderColor={active ? 'blue.solid' : 'border'}
            fontWeight={active ? 'semibold' : 'medium'}
            _hover={{ bg: active ? 'blue.700' : 'blue.subtle' }}
            onClick={() => onToggle(tag)}
          >
            {tag}
          </Button>
        )
      })}
    </HStack>
  )
}
