import { useId, useState } from 'react'
import { Box, Button, HStack, Stack, Text, Textarea } from '@chakra-ui/react'

export default function ReviewForm({ initialReview, pending, onSave, onCancel }) {
  const formId = useId()
  const [body, setBody] = useState(initialReview?.body ?? '')
  const [rating, setRating] = useState(initialReview?.rating ?? 0)
  const [validation, setValidation] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!rating) { setValidation('Choose a star rating.'); return }
    if (!body.trim() || body.trim().length > 2000) {
      setValidation('Write a review between 1 and 2,000 characters.')
      return
    }
    setValidation('')
    await onSave(body.trim(), rating)
  }

  return (
    <Stack as="form" onSubmit={submit} gap={3}>
      <Box as="fieldset" border="0" p="0" m="0" disabled={pending}>
        <Text as="legend" fontWeight="medium" mb={2}>Your rating</Text>
        <HStack gap={1}>
          {[1, 2, 3, 4, 5].map((score) => (
            <Box as="label" key={score} position="relative" cursor={pending ? 'default' : 'pointer'} rounded="sm"
              _focusWithin={{ outline: '2px solid', outlineColor: 'blue.solid', outlineOffset: '2px' }}>
                <input type="radio" name={`${formId}-rating`} value={score} checked={rating === score}
                  aria-label={`${score} ${score === 1 ? 'star' : 'stars'}`} required
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, margin: 0, cursor: 'inherit' }}
                  onChange={() => { setRating(score); setValidation('') }} />
              <Text as="span" display="inline-flex" alignItems="center" justifyContent="center" minW="44px" minH="44px"
                fontSize="3xl" color={score <= rating ? 'orange.fg' : 'fg.muted'} aria-hidden="true">{score <= rating ? '★' : '☆'}</Text>
            </Box>
          ))}
          <Text fontSize="sm" color="fg.muted">{rating ? `${rating}/5` : ''}</Text>
        </HStack>
      </Box>
      <Text as="label" htmlFor={`${formId}-body`} fontWeight="medium">{initialReview ? 'Edit your review' : 'Write a review'}</Text>
      <Textarea id={`${formId}-body`} value={body} maxLength={2000} required rows={4} disabled={pending}
        placeholder="What was your experience like?" aria-describedby={`${formId}-limit`}
        onChange={(event) => { setBody(event.target.value); setValidation('') }} />
      <Text id={`${formId}-limit`} fontSize="xs" color="fg.muted">{body.length}/2,000 characters</Text>
      {validation && <Text role="alert" color="fg.error">{validation}</Text>}
      <HStack>
        <Button type="submit" colorPalette="blue" loading={pending} disabled={pending}>{initialReview ? 'Save changes' : 'Post review'}</Button>
        {onCancel && <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>Cancel</Button>}
      </HStack>
    </Stack>
  )
}
