import { Text } from '@chakra-ui/react'

export default function ReviewRating({ rating }) {
  if (!rating) return <Text fontSize="sm" color="fg.muted">Not rated</Text>
  return <Text color="orange.fg" fontSize="lg" aria-label={`${rating} out of 5 stars`}>
    <span aria-hidden="true">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
  </Text>
}
