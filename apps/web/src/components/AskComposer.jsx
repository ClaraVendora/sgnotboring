import { HStack, IconButton, Textarea } from '@chakra-ui/react'
import { LuSendHorizontal } from 'react-icons/lu'

// Message box for the Ask page. Enter sends, Shift+Enter adds a line. Grows with its
// content (CSS field-sizing) up to maxH.
export default function AskComposer({ value, onChange, onSubmit, disabled }) {
  const canSend = !disabled && value.trim().length > 0
  const submit = (e) => {
    e.preventDefault()
    if (canSend) onSubmit()
  }

  return (
    <HStack as="form" onSubmit={submit} gap={2} align="flex-end">
      <Textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
        }}
        placeholder="Cheap supper in Bugis with friends…"
        aria-label="What are you in the mood for?"
        maxLength={500}
        rows={1}
        resize="none"
        maxH="32"
        rounded="xl"
        fontSize="md" // 16px stops iOS zooming in on focus
        css={{ fieldSizing: 'content' }}
      />
      <IconButton type="submit" aria-label="Send" colorPalette="teal" rounded="full" disabled={!canSend}>
        <LuSendHorizontal />
      </IconButton>
    </HStack>
  )
}
