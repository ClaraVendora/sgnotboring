import { Link as RouterLink } from 'react-router-dom'
import { Badge, Card, HStack, LinkBox, LinkOverlay, Text, Wrap } from '@chakra-ui/react'
import { openStatus } from '../lib/hours.js'

// `reason`: optional one-liner from /ask on why this place was picked.
export default function PlaceCard({ place, reason }) {
  const status = openStatus(place.opening_hours)
  return (
    <LinkBox as={Card.Root} _hover={{ shadow: 'md' }} transition="box-shadow 0.15s">
      <Card.Body gap={2}>
        <Card.Title>
          <LinkOverlay asChild>
            <RouterLink to={`/places/${place.id}`}>{place.name}</RouterLink>
          </LinkOverlay>
        </Card.Title>
        <HStack gap={3} fontSize="sm" color="fg.muted">
          {place.rating != null && <Text>★ {place.rating} ({place.user_ratings_total ?? 0})</Text>}
          {place.price_level != null && <Text>{place.price_level === 0 ? 'Free' : '$'.repeat(place.price_level)}</Text>}
          <Badge colorPalette={status.color} variant="subtle">
            {status.label}
          </Badge>
        </HStack>
        {place.address && <Text fontSize="sm" color="fg.muted">{place.address}</Text>}
        {reason && (
          <Text fontSize="sm" fontWeight="medium" color="teal.fg">
            {reason}
          </Text>
        )}
        {place.summary && <Card.Description>{place.summary}</Card.Description>}
        <Wrap gap={1}>
          {place.tags.map((t) => (
            <Badge key={t} variant="outline" size="sm">
              {t}
            </Badge>
          ))}
        </Wrap>
      </Card.Body>
    </LinkBox>
  )
}
