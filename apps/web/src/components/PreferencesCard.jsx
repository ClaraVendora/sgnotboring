import { Link as RouterLink } from 'react-router-dom'
import { Badge, Button, Card, Heading, HStack, Skeleton, Stack, Text, Wrap } from '@chakra-ui/react'
import { LuPencilLine } from 'react-icons/lu'

export default function PreferencesCard({ preferences, loading, error, onRetry }) {
  return (
    <Card.Root as="section" aria-labelledby="preferences-heading" rounded="xl">
      <Card.Body p={{ base: 5, md: 6 }} gap={4}>
        <HStack justify="space-between" gap={3} flexWrap="wrap">
          <Heading id="preferences-heading" as="h2" size="xl">My preferences</Heading>
          {!loading && !error && <Button asChild variant="outline" size="sm" minH="44px">
            <RouterLink to="/onboarding">
              <LuPencilLine aria-hidden="true" />{preferences ? 'Edit' : 'Take survey'}
            </RouterLink>
          </Button>}
        </HStack>
        {loading ? <Stack role="status" gap={3}>
          <Text fontSize="sm" color="fg.muted">Loading preferences…</Text>
          <HStack aria-hidden="true"><Skeleton h="6" w="20" /><Skeleton h="6" w="24" /><Skeleton h="6" w="16" /></HStack>
        </Stack> : error ? <Stack gap={2}>
          <Text role="alert" color="fg.error" fontSize="sm">{error}</Text>
          <Button variant="outline" alignSelf="start" size="sm" onClick={onRetry}>Retry preferences</Button>
        </Stack> : preferences?.tags.length ? <Stack gap={3}>
          <Text fontSize="sm" color="fg.muted">Used when you turn on Personalised in Ask.</Text>
          <Wrap gap={2}>
            {preferences.tags.map((tag) => <Badge key={tag} colorPalette="blue" variant="subtle" rounded="full" px={3} py={1}>{tag}</Badge>)}
          </Wrap>
        </Stack> : <Text fontSize="sm" color="fg.muted">No preferences selected yet. Take the short taste survey to tell us what you enjoy.</Text>}
      </Card.Body>
    </Card.Root>
  )
}
