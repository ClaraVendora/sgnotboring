import { Text } from '@chakra-ui/react'

// One-line result of an action: announced as an alert when it failed, as a status otherwise.
export default function FeedbackText({ feedback, ...props }) {
  if (!feedback) return null
  return <Text role={feedback.error ? 'alert' : 'status'} color={feedback.error ? 'fg.error' : 'blue.fg'} {...props}>
    {feedback.message}
  </Text>
}
