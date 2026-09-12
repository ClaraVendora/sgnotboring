import { useEffect, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Badge, Container, Heading, HStack, Link, Spinner, Stack, Text, Wrap } from '@chakra-ui/react'
import { getPlace } from '../lib/api.js'
import { openStatus } from '../lib/hours.js'

export default function PlaceDetail() {
  const { id } = useParams()
  const [place, setPlace] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getPlace(id).then(setPlace).catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return (
      <Container maxW="3xl" py={10}>
        <Text color="fg.error">{error}</Text>
        <Link asChild mt={4} display="inline-block">
          <RouterLink to="/">← Back</RouterLink>
        </Link>
      </Container>
    )
  }
  if (!place) {
    return (
      <Container maxW="3xl" py={10}>
        <Spinner />
      </Container>
    )
  }

  const status = openStatus(place.opening_hours)
  return (
    <Container maxW="3xl" py={10}>
      <Stack gap={4}>
        <Link asChild alignSelf="flex-start">
          <RouterLink to="/">← Back</RouterLink>
        </Link>
        <Heading size="3xl">{place.name}</Heading>
        <HStack gap={3} color="fg.muted">
          {place.rating != null && (
            <Text>
              ★ {place.rating} ({place.user_ratings_total ?? 0})
            </Text>
          )}
          {place.price_level != null && <Text>{'$'.repeat(place.price_level)}</Text>}
          <Badge colorPalette={status.color} variant="subtle">
            {status.label}
          </Badge>
        </HStack>
        {place.address && <Text>{place.address}</Text>}
        {place.summary && <Text fontSize="lg">{place.summary}</Text>}
        <Wrap gap={1}>
          {place.tags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </Wrap>
      </Stack>
    </Container>
  )
}
