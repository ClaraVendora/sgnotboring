import { Avatar, Button, Card, Heading, HStack, Skeleton, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import ProfileEditor from './ProfileEditor.jsx'
import { profileIcon } from '../lib/profile.js'

export default function AccountProfileCard({ name, displayName, email, icon, pendingEmail, loading, error, onRetry, onSave, pending, feedback }) {
  const [editing, setEditing] = useState(false)
  const selectedIcon = profileIcon(icon)
  return (
    <Card.Root as="section" aria-label="Your profile" rounded="xl">
      <Card.Body p={{ base: 5, md: 6 }} gap={4}>
        <HStack gap={4} align="start">
          <Avatar.Root role="img" aria-label={`Profile icon: ${selectedIcon.label}`} size="lg" colorPalette="blue" flexShrink={0} mt={6}>
            <Avatar.Fallback name={name}>{selectedIcon.symbol || undefined}</Avatar.Fallback>
          </Avatar.Root>
          <Stack gap={1} minW={0}>
            <Text fontSize="xs" color="fg.muted" fontWeight="medium">Your profile</Text>
            <Heading as="h2" size="xl" overflowWrap="anywhere">{name}</Heading>
            <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere">{email}</Text>
          </Stack>
        </HStack>
        {pendingEmail && <Text fontSize="sm" color="fg.muted">Email change to {pendingEmail} is awaiting confirmation. Your current email remains active.</Text>}
        {onSave && !editing && <Button variant="outline" size="sm" alignSelf="start" disabled={loading || Boolean(error)} onClick={() => setEditing(true)}>Edit profile</Button>}
        {editing && <ProfileEditor name={displayName} email={email} icon={icon} pending={pending} onSave={onSave} onCancel={() => setEditing(false)} />}
        {feedback && <Text role={feedback.error ? 'alert' : 'status'} fontSize="sm" color={feedback.error ? 'fg.error' : 'fg.success'}>{feedback.message}</Text>}
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
