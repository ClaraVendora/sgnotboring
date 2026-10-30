import { Avatar, Button, Card, Heading, HStack, Skeleton, Stack, Text } from '@chakra-ui/react'

export default function AccountProfileCard({ name, email, loading, error, onRetry }) {
  return (
    <Card.Root as="section" aria-label="Your profile" rounded="xl">
      <Card.Body p={{ base: 5, md: 6 }} gap={4}>
        <HStack gap={4} align="start">
          <Avatar.Root size="lg" colorPalette="blue" flexShrink={0}>
            <Avatar.Fallback name={name} />
          </Avatar.Root>
          <Stack gap={1} minW={0}>
            <Text fontSize="xs" color="fg.muted" fontWeight="medium">Your profile</Text>
            <Heading as="h2" size="xl" overflowWrap="anywhere">{name}</Heading>
            <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere">{email}</Text>
          </Stack>
        </HStack>
        {error ? (
          <Stack gap={2}>
            <Text role="alert" color="fg.error" fontSize="sm">{error}</Text>
            <Button variant="outline" alignSelf="start" size="sm" onClick={onRetry}>Retry account</Button>
          </Stack>
        ) : loading ? (
          <Stack role="status" gap={2}>
            <Text fontSize="sm" color="fg.muted">Loading your account…</Text>
            <Skeleton height="3" width="40%" />
          </Stack>
        ) : null}
      </Card.Body>
    </Card.Root>
  )
}
