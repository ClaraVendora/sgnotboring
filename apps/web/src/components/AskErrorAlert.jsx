import { Alert, Button } from '@chakra-ui/react'

// [title, description] per failure kind from AskProvider. The message is always kept.
const COPY = {
  failed: ['Something went wrong', "We couldn't get recommendations. Your message is kept, so you can try again."],
  timeout: ['Something went wrong', 'That took longer than usual. Your message is kept, so you can try again.'],
  busy: ['AI Search is busy', 'Lots of people are asking right now. Your message is kept; try again in a minute.'],
  overloaded: ['The AI is overloaded', "It's a bit swamped right now. Your message is kept; try again in a few seconds."],
}

// Inline alert under a message that got no reply, with Retry.
export default function AskErrorAlert({ kind, onRetry, disabled }) {
  const [title, description] = COPY[kind] ?? COPY.failed
  return (
    <Alert.Root role="alert" status={kind === 'busy' || kind === 'overloaded' ? 'warning' : 'error'} rounded="xl" alignItems="center">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{description}</Alert.Description>
      </Alert.Content>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={disabled} flexShrink={0}>Retry</Button>
    </Alert.Root>
  )
}
