import { Link as RouterLink } from 'react-router-dom'
import { Container, Heading, Link, Text } from '@chakra-ui/react'

export default function NotFound() {
  return (
    <Container maxW="3xl" py={10}>
      <Heading size="2xl">Page not found</Heading>
      <Text color="fg.muted" mt={2}>
        That route doesn't exist.
      </Text>
      <Link asChild mt={4} display="inline-block">
        <RouterLink to="/">← Home</RouterLink>
      </Link>
    </Container>
  )
}
