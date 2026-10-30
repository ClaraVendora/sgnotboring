import { Link as RouterLink } from 'react-router-dom'
import { Badge, Card, HStack, LinkBox, LinkOverlay, Text, Wrap } from '@chakra-ui/react'
import { useOpenStatus } from '../hooks/useOpenStatus.js'
import PlacePhoto from './PlacePhoto.jsx'
import SaveButton from './SaveButton.jsx'

// `reason`: optional one-liner from /ask on why this place was picked.
export default function PlaceCard({ place, reason, save, compact = false }) {
  const status = useOpenStatus(place?.opening_hours)
  return (
    <LinkBox as={Card.Root} overflow="hidden" _hover={{ shadow: 'md' }} transition="box-shadow 0.15s">
      {!compact && <PlacePhoto src={place.photo_url} name={place.name} />}
      <Card.Body gap={2}>
        <HStack justify="space-between" align="start" gap={3}>
          <Card.Title flex="1">
            <LinkOverlay asChild>
              <RouterLink to={`/places/${place.id}`}>{place.name}</RouterLink>
            </LinkOverlay>
          </Card.Title>
          {save && <SaveButton name={place.name} {...save} />}
        </HStack>
        <HStack gap={3} flexWrap="wrap" fontSize="sm" color="fg.muted">
          {place.rating != null && <Text>★ {place.rating} ({place.user_ratings_total ?? 0})</Text>}
          {place.price_level != null && <Text>{place.price_level === 0 ? 'Free' : '$'.repeat(place.price_level)}</Text>}
          <Badge colorPalette={status.color} variant="subtle">
            {status.label}
          </Badge>
        </HStack>
        {place.address && <Text fontSize="sm" color="fg.muted">{place.address}</Text>}
        {reason && (
          <Text fontSize="sm" fontWeight="medium" color="blue.fg">
            {reason}
          </Text>
        )}
        {!compact && place.summary && <Card.Description>{place.summary}</Card.Description>}
        <Wrap gap={1}>
          {(compact ? place.tags.slice(0, 3) : place.tags).map((t) => (
            <Badge key={t} variant="outline" size="sm">
              {t}
            </Badge>
          ))}
        </Wrap>
      </Card.Body>
    </LinkBox>
  )
}
