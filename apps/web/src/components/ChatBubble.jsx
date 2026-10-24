import { Box } from '@chakra-ui/react'

// One chat message. `from` is 'user' (right, blue) or 'assistant' (left, muted).
export default function ChatBubble({ from, children }) {
  if (!children) return null
  const mine = from === 'user'
  return (
    <Box
      alignSelf={mine ? 'flex-end' : 'flex-start'}
      maxW="85%"
      px={4}
      py={2.5}
      rounded="2xl"
      roundedBottomRight={mine ? 'sm' : '2xl'}
      roundedBottomLeft={mine ? '2xl' : 'sm'}
      bg={mine ? 'blue.solid' : 'bg.muted'}
      color={mine ? 'blue.contrast' : 'fg'}
      whiteSpace="pre-wrap"
    >
      {children}
    </Box>
  )
}
