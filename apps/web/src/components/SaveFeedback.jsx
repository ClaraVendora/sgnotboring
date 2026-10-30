import { Link as RouterLink } from 'react-router-dom'
import { Button, HStack, Link, Stack, Text } from '@chakra-ui/react'

export default function SaveFeedback({ feedback, loadError, onDismiss, onRetry, inline = false }) {
  if (!feedback && !loadError) return null
  return <Stack gap={2} p={4} rounded="lg" borderWidth="1px" bg="bg.panel" shadow="lg"
    position={inline ? 'static' : 'fixed'} bottom="calc(var(--bottom-nav-space) + 12px)"
    left={{ base: 4, md: 'auto' }} right={4} maxW={inline ? 'full' : '440px'} zIndex={10}>
    {loadError && <HStack justify="space-between" flexWrap="wrap">
      <Text role="alert" color="fg.error">{loadError}</Text>
      <Button variant="outline" size="sm" onClick={onRetry}>Retry saved places</Button>
    </HStack>}
    {feedback && <Stack gap={2}>
      <Text role={feedback.error ? 'alert' : 'status'} color={feedback.error ? 'fg.error' : 'fg'}>{feedback.message}</Text>
      <HStack>
        {feedback.login && <Link asChild colorPalette="blue"><RouterLink to="/profile">Log in</RouterLink></Link>}
        <Button variant="plain" size="sm" onClick={onDismiss}>Dismiss</Button>
      </HStack>
    </Stack>}
  </Stack>
}
