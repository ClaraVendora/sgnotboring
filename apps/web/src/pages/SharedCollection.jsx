import { useEffect, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Badge, Button, Container, Heading, Link, Spinner, Stack, Text } from '@chakra-ui/react'
import { getSharedCollection } from '../lib/api.js'
import CollectionPlaces from '../components/CollectionPlaces.jsx'

export default function SharedCollection() {
  const { token } = useParams()
  const [attempt, setAttempt] = useState(0)
  const key = `${token}:${attempt}`
  const [result, setResult] = useState({ key: null, collection: null, error: null })
  useEffect(() => {
    let cancelled = false
    getSharedCollection(token)
      .then(({ collection }) => !cancelled && setResult({ key, collection, error: null }))
      .catch((error) => !cancelled && setResult({ key, collection: null, error }))
    return () => { cancelled = true }
  }, [token, key])
  return <Container maxW="3xl" py={10}><Stack gap={5}>
    <Link asChild colorPalette="blue" alignSelf="start"><RouterLink to="/">← Discover places</RouterLink></Link>
    {result.key !== key ? <Spinner /> : result.error ? <Stack align="start">
      <Heading size="xl">{result.error.status === 404 ? 'Collection not found' : 'Could not load collection'}</Heading>
      <Text role="alert" color="fg.error">This shared collection is unavailable. Check the link or try again.</Text>
      <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry collection</Button>
    </Stack> : <>
      <Heading size="3xl" overflowWrap="anywhere">{result.collection.name}</Heading>
      <Badge alignSelf="start">Shared collection · View only</Badge>
      <Text color="fg.muted">{result.collection.places.length} {result.collection.places.length === 1 ? 'place' : 'places'}</Text>
      <CollectionPlaces places={result.collection.places} />
    </>}
  </Stack></Container>
}
