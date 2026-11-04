import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Container, Heading, HStack, Link, Spinner, Stack, Text } from '@chakra-ui/react'
import { deleteMyReview, getMyReviews, updateMyReview } from '../lib/api.js'
import { useSession } from '../hooks/useSession.js'
import ReviewForm from '../components/ReviewForm.jsx'
import ReviewRating from '../components/ReviewRating.jsx'
import { reviewDateLabel } from '../lib/reviews.js'

export default function MyReviews() {
  const { session, loading } = useSession()
  return (
    <Container maxW="3xl" py={10}>
      <Stack gap={6}>
        <Link asChild colorPalette="blue" alignSelf="start"><RouterLink to="/profile">← Back to Account</RouterLink></Link>
        <Stack gap={2}>
          <Heading size="3xl">My reviews</Heading>
          <Text color="fg.muted">Your ratings and experiences, all in one place.</Text>
        </Stack>
        {loading ? <Spinner /> : session
          ? <ReviewHistory key={session.user.id} />
          : <Stack align="start"><Text>Log in to see your reviews and ratings.</Text><Button asChild colorPalette="blue"><RouterLink to="/profile">Log in</RouterLink></Button></Stack>}
      </Stack>
    </Container>
  )
}

function ReviewHistory() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ attempt: null, reviews: [], error: null })
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const busy = useRef(false)
  const loading = result.attempt !== attempt

  useEffect(() => {
    let cancelled = false
    getMyReviews()
      .then(({ reviews }) => !cancelled && setResult({ attempt, reviews, error: null }))
      .catch((error) => !cancelled && setResult({ attempt, reviews: [], error }))
    return () => { cancelled = true }
  }, [attempt])

  async function mutate(review, operation, body, rating) {
    if (busy.current) return false
    busy.current = true
    setPending(true)
    setFeedback(null)
    try {
      if (operation === 'delete') {
        await deleteMyReview(review.id)
        setResult((previous) => ({ ...previous, reviews: previous.reviews.filter((row) => row.id !== review.id) }))
        setConfirming(null)
      } else {
        const { review: updated } = await updateMyReview(review.id, body, rating)
        setResult((previous) => ({ ...previous, reviews: previous.reviews.map((row) => row.id === review.id ? updated : row) }))
        setEditing(null)
      }
      setFeedback({ message: operation === 'delete' ? 'Review deleted.' : 'Review updated.' })
      return true
    } catch (error) {
      setFeedback({ error: true, message: error.status === 401 ? 'Please log in again to manage your reviews.'
        : operation === 'delete' ? 'Could not delete your review. Please try again.' : 'Could not save changes. Your draft is still here; please try again.' })
      return false
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  if (loading) return <HStack role="status"><Spinner size="sm" /><Text>Loading your reviews…</Text></HStack>
  if (result.error) return <Stack align="start"><Text role="alert" color="fg.error">{result.error.status === 401 ? 'Please log in again to see your reviews.' : 'Could not load your reviews. Please try again.'}</Text><Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry reviews</Button></Stack>

  return (
    <Stack gap={4}>
      {feedback && <Text role={feedback.error ? 'alert' : 'status'} color={feedback.error ? 'fg.error' : 'fg.success'}>{feedback.message}</Text>}
      {result.reviews.length === 0 && <Stack align="start"><Text>You haven’t reviewed any places yet.</Text><Button asChild variant="outline"><RouterLink to="/">Explore places</RouterLink></Button></Stack>}
      {result.reviews.map((review) => (
        <Box as="article" aria-label={`Your review of ${review.place?.name ?? 'this place'}`} key={review.id} borderWidth="1px" bg="bg.panel" rounded="xl" p={{ base: 4, md: 6 }}>
          <Stack gap={4}>
            <Heading size="lg" overflowWrap="anywhere"><Link asChild><RouterLink to={`/places/${review.place_id}`}>{review.place?.name ?? 'View place'}</RouterLink></Link></Heading>
            <ReviewRating rating={review.rating} />
            <Stack gap={1} color="fg.muted" fontSize="sm">
              <Text>Reviewed <time dateTime={review.created_at}>{reviewDateLabel(review.created_at)} SGT</time></Text>
              {review.updated_at !== review.created_at && <Text>Edited <time dateTime={review.updated_at}>{reviewDateLabel(review.updated_at)} SGT</time></Text>}
            </Stack>
            {editing === review.id
              ? <ReviewForm initialReview={review} pending={pending} onSave={(body, rating) => mutate(review, 'edit', body, rating)} onCancel={() => { setEditing(null); setFeedback(null) }} />
              : <>
                <Text whiteSpace="pre-wrap" overflowWrap="anywhere">{review.body}</Text>
                {confirming === review.id ? <Stack gap={3}>
                  <Text>Delete your review for {review.place?.name ?? 'this place'}?</Text>
                  <HStack flexWrap="wrap">
                    <Button colorPalette="red" disabled={pending} loading={pending} onClick={() => mutate(review, 'delete')}>Confirm delete</Button>
                    <Button variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>Cancel</Button>
                  </HStack>
                </Stack> : <HStack>
                  <Button variant="outline" disabled={pending} onClick={() => { setEditing(review.id); setConfirming(null); setFeedback(null) }}>Edit review</Button>
                  <Button variant="ghost" colorPalette="red" disabled={pending} onClick={() => { setConfirming(review.id); setEditing(null); setFeedback(null) }}>Delete review</Button>
                </HStack>}
              </>}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}
