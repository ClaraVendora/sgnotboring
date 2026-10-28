import { Link as RouterLink } from 'react-router-dom'
import { Badge, Card, Flex, HStack, LinkBox, LinkOverlay, Text, Wrap } from '@chakra-ui/react'
import { useOpenStatus } from '../hooks/useOpenStatus.js'
import { placeMeta } from '../lib/place-card.js'
import PlacePhoto from './PlacePhoto.jsx'
import SaveButton from './SaveButton.jsx'

// `save` and `compact` retain the interface used by SGN-015's saved places list.
export default function PlaceCard({ place, reason, save, compact = false }) {
  const status = useOpenStatus(place?.opening_hours)
  if (!place) return null
  const label = status.label === 'Open now' ? 'OPEN' : status.label === 'Closed' ? 'CLOSED' : status.label
  return (
    <LinkBox as={Card.Root} overflow="hidden" _hover={{ shadow: 'md' }} transition="box-shadow 0.15s">
      <Flex direction={compact ? 'row' : 'column'} gap={compact ? 3 : 0} p={compact ? 3 : 0}>
        <PlacePhoto src={place.photo_url} name={place.name} compact={compact} />
        <Card.Body gap={2} p={compact ? 0 : 4} minW={0}>
          <HStack justify="space-between" align="start" gap={2}>
            <HStack gap={2} flexWrap="wrap" minW={0}>
              <Card.Title fontSize={compact ? 'md' : 'lg'} overflowWrap="anywhere">
                <LinkOverlay asChild><RouterLink to={`/places/${place.id}`}>{place.name}</RouterLink></LinkOverlay>
              </Card.Title>
              <Badge colorPalette={status.color} variant="subtle" size="sm">{label}</Badge>
            </HStack>
            {save && <SaveButton name={place.name} {...save} />}
          </HStack>
          <Text fontSize="xs" color="fg.muted" lineHeight={1.7}>{placeMeta(place)}</Text>
          <Wrap gap={1}>
            {(place.tags ?? []).slice(0, 3).map((tag) => <Badge key={tag} variant="outline" size="sm">{tag}</Badge>)}
          </Wrap>
          {reason && <Text fontSize="sm" fontWeight="medium" color="blue.fg">{reason}</Text>}
          {!compact && place.summary && <Card.Description lineClamp={2}>{place.summary}</Card.Description>}
        </Card.Body>
      </Flex>
    </LinkBox>
  )
}
