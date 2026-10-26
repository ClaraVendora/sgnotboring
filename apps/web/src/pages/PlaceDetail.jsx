import { useEffect, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Badge, Container, Heading, HStack, Link, Spinner, Stack, Text, Wrap } from '@chakra-ui/react'
import { getPlace } from '../lib/api.js'
import { useOpenStatus } from '../hooks/useOpenStatus.js'
import PlacePhoto from '../components/PlacePhoto.jsx'
import SaveButton from '../components/SaveButton.jsx'
import SaveFeedback from '../components/SaveFeedback.jsx'
import { useSavedPlaces } from '../hooks/useSavedPlaces.js'

export default function PlaceDetail() {
  const saves = useSavedPlaces()
  const { id } = useParams()
  const [result, setResult] = useState({ id: null, place: null, error: null })
  const { place, error } = result.id === id ? result : { place: null, error: null }
  const status = useOpenStatus(place?.opening_hours)

  useEffect(() => {
    let cancelled = false
    getPlace(id)
      .then((place) => !cancelled && setResult({ id, place, error: null }))
      .catch((error) => !cancelled && setResult({ id, place: null, error }))
    return () => { cancelled = true }
  }, [id])

  if (error) {
    return (
      <Container maxW="3xl" py={10}>
        <Heading size="xl">{error.status === 404 ? 'Place not found' : 'Could not load this place'}</Heading>
        <Text color="fg.error">{error.status === 404 ? 'This place may have been removed.' : error.message}</Text>
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

  return (
    <Container maxW="3xl" py={10}>
      <Stack gap={4}>
        <Link asChild alignSelf="flex-start">
          <RouterLink to="/">← Back</RouterLink>
        </Link>
        <HStack justify="space-between" align="start">
          <Heading size="3xl">{place.name}</Heading>
          <SaveButton name={place.name} {...saves.buttonProps(place)} />
        </HStack>
        <SaveFeedback feedback={saves.feedback} loadError={saves.loadError} onDismiss={saves.dismiss} onRetry={saves.retry} />
        <PlacePhoto src={place.photo_url} name={place.name} loading="eager" />
        <HStack gap={3} color="fg.muted">
          {place.rating != null && (
            <Text>
              ★ {place.rating} ({place.user_ratings_total ?? 0})
            </Text>
          )}
          {place.price_level != null && <Text>{place.price_level === 0 ? 'Free' : '$'.repeat(place.price_level)}</Text>}
          <Badge colorPalette={status.color} variant="subtle">
            {status.label}
          </Badge>
        </HStack>
        {place.address && <Text>{place.address}</Text>}
        {place.opening_hours?.weekdayDescriptions?.length > 0 && (
          <Stack gap={1}>
            <Heading size="md">Opening hours</Heading>
            {place.opening_hours.weekdayDescriptions.map((day) => <Text key={day} fontSize="sm">{day}</Text>)}
          </Stack>
        )}
        {place.google_maps_uri && (
          <Link href={place.google_maps_uri} target="_blank" rel="noreferrer" colorPalette="blue" alignSelf="flex-start">
            Open in Google Maps ↗
          </Link>
        )}
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
