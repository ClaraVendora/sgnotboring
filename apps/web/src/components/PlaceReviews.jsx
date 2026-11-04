import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Heading, HStack, Link, Spinner, Stack, Text } from '@chakra-ui/react'
import ReviewForm from './ReviewForm.jsx'
import ReviewRating from './ReviewRating.jsx'
import { reviewDateLabel } from '../lib/reviews.js'

export default function PlaceReviews({ reviews, userId, loading, error, pending, saveError, success, onSave, onRetry }) {
  const own = reviews.find((review) => review.user_id === userId)
  const [editing, setEditing] = useState(false)
  const showForm = userId && (!own || editing)

  async function submit(body, rating) {
    if (await onSave(body, rating)) setEditing(false)
  }

  return (
    <Stack as="section" aria-labelledby="reviews-heading" gap={4} borderTopWidth="1px" pt={6} mt={4}>
      <Heading id="reviews-heading" size="xl">Community reviews{!loading && !error ? ` (${reviews.length})` : ''}</Heading>
      {loading && <HStack><Spinner size="sm" /><Text>Loading reviews…</Text></HStack>}
      {error && <Stack align="start"><Text role="alert" color="fg.error">Could not load reviews. Please try again.</Text><Button variant="outline" onClick={onRetry}>Retry reviews</Button></Stack>}
      {!loading && !error && <>
        {!userId && <Text color="fg.muted"><Link asChild colorPalette="blue"><RouterLink to="/profile">Log in</RouterLink></Link> to leave a review.</Text>}
        {showForm && (
          <ReviewForm initialReview={own} pending={pending} onSave={submit}
            onCancel={own ? () => setEditing(false) : undefined} />
        )}
        {saveError && <Text role="alert" color="fg.error">{saveError}</Text>}
        {success && <Text role="status" color="fg.success">Your review has been saved.</Text>}
        {reviews.length === 0 && <Text color="fg.muted">No reviews yet. Be the first to share your experience.</Text>}
        {reviews.map((review) => (
          <Box as="article" key={review.id} borderWidth="1px" rounded="lg" p={4}>
            <Stack gap={3}>
              <HStack justify="space-between" align="start" flexWrap="wrap">
                <Stack gap={1}>
                  <Text fontWeight="semibold">{review.author_name}{review.user_id === userId ? ' (you)' : ''}</Text>
                  <ReviewRating rating={review.rating} />
                  <Text fontSize="xs" color="fg.muted"><time dateTime={review.created_at}>{reviewDateLabel(review.created_at)} SGT</time>{review.updated_at !== review.created_at ? ' · Edited' : ''}</Text>
                </Stack>
                {review.user_id === userId && !editing && <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>Edit review</Button>}
              </HStack>
              <Text whiteSpace="pre-wrap" overflowWrap="anywhere">{review.body}</Text>
            </Stack>
          </Box>
        ))}
      </>}
    </Stack>
  )
}
