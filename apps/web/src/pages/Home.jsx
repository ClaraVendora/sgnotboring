import { useEffect, useState } from 'react'
import { Container, Heading, Stack, Text } from '@chakra-ui/react'
import { getHealth } from '../lib/api.js'

export default function Home() {
  const [status, setStatus] = useState('checking…')

  useEffect(() => {
    getHealth()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('api unreachable'))
  }, [])

  return (
    <Container maxW="4xl" py={12}>
      <Stack gap={4}>
        <Heading size="3xl">SG is not boring</Heading>
        <Text color="fg.muted">
          Discover food and experiences around Singapore, curated so you don't have to dig.
        </Text>
        <Text fontSize="sm">API status: {status}</Text>
      </Stack>
    </Container>
  )
}
