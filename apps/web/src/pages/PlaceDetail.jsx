import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Badge, Container, Heading, HStack, Link, Spinner, Stack, Text, Wrap } from '@chakra-ui/react'
import { getPlace, getPlaceReviews, savePlaceReview } from '../lib/api.js'
import { useOpenStatus } from '../hooks/useOpenStatus.js'
import PlacePhoto from '../components/PlacePhoto.jsx'
import SaveButton from '../components/SaveButton.jsx'
import SaveFeedback from '../components/SaveFeedback.jsx'
import { useSavedPlaces } from '../hooks/useSavedPlaces.js'
import { useSession } from '../hooks/useSession.js'
import PlaceReviews from '../components/PlaceReviews.jsx'

export default function PlaceDetail() {
  const saves = useSavedPlaces()
  const { id } = useParams()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user?.id
  const actionKey = `${id}:${userId ?? 'guest'}`
  const [reviewsResult, setReviewsResult] = useState({ id: null, reviews: [], error: null })
  const [reviewsAttempt, setReviewsAttempt] = useState(0)
  const [reviewAction, setReviewAction] = useState({ key: null })
  const inFlight = useRef(new Set())
  const reviews = reviewsResult.id === id ? reviewsResult.reviews : []
  const reviewsLoading = reviewsResult.id !== id
  const action = reviewAction.key === actionKey ? reviewAction : {}
  const location = useLocation()
  const navigate = useNavigate()
  const [result, setResult] = useState({ id: null, place: null, error: null })
  const { place, error } = result.id === id ? result : { place: null, error: null }
  const status = useOpenStatus(place?.opening_hours)
  // Back returns to wherever the place was opened from (AI Search, Home, Account), like the
  // browser's back button, so that page can restore itself. Opened directly: go Home.
  const back = (event) => {
    if (location.key === 'default') return
    event.preventDefault()
    navigate(-1)
  }

  // Start at the top even when opened from far down a list or conversation.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [id])

  useEffect(() => {
    let cancelled = false
    getPlaceReviews(id)
      .then(({ reviews }) => !cancelled && setReviewsResult({ id, reviews, error: null }))
      .catch((error) => !cancelled && setReviewsResult({ id, reviews: [], error }))
    return () => { cancelled = true }
  }, [id, reviewsAttempt])

  async function saveReview(body, rating) {
    if (!userId || inFlight.current.has(actionKey)) return false
    inFlight.current.add(actionKey)
    setReviewAction({ key: actionKey, pending: true })
    try {
      const { review } = await savePlaceReview(id, body, rating)
      setReviewsResult((previous) => previous.id !== id ? previous : {
        ...previous, reviews: previous.reviews.some((item) => item.id === review.id)
          ? previous.reviews.map((item) => item.id === review.id ? review : item)
          : [review, ...previous.reviews],
      })
      setReviewAction({ key: actionKey, success: true })
      return true
    } catch (error) {
      setReviewAction({ key: actionKey, error: error.status === 401
        ? 'Please log in again to save your review.' : 'Could not save your review. Your text is still here; please try again.' })
      return false
    } finally {
      inFlight.current.delete(actionKey)
    }
  }

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
          <RouterLink to="/" onClick={back}>← Back</RouterLink>
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
          <RouterLink to="/" onClick={back}>← Back</RouterLink>
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
        <PlaceReviews key={`${actionKey}:${reviewsLoading ? 'loading' : 'ready'}`}
          reviews={reviews} userId={userId} loading={reviewsLoading || sessionLoading}
          error={reviewsResult.id === id && reviewsResult.error} pending={Boolean(action.pending)}
          saveError={action.error} success={action.success} onSave={saveReview}
          onRetry={() => setReviewsAttempt((value) => value + 1)} />
      </Stack>
    </Container>
  )
}
