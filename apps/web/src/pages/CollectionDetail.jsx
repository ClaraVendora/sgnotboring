import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Badge, Box, Button, Container, Heading, HStack, IconButton, Input, Link, Spinner, Stack, Text } from '@chakra-ui/react'
import { LuShare2 } from 'react-icons/lu'
import { addCollectionPlace, getCollection, getPlaces, removeCollectionPlace, shareCollection } from '../lib/api.js'
import { useSession } from '../hooks/useSession.js'
import CollectionPlaces from '../components/CollectionPlaces.jsx'
import PlaceSearch from '../components/PlaceSearch.jsx'

export default function CollectionDetail() {
  const { id } = useParams()
  const { session, loading } = useSession()
  return <Container maxW="3xl" py={10}><Stack gap={6}>
    <Link asChild colorPalette="blue" alignSelf="start"><RouterLink to="/profile">← Back to Account</RouterLink></Link>
    {loading ? <Spinner /> : session ? <OwnerCollection key={`${id}:${session.user.id}`} id={id} />
      : <Stack align="start"><Heading size="2xl">Collection</Heading><Text>Log in to open your collection.</Text><Button asChild colorPalette="blue"><RouterLink to="/profile">Log in</RouterLink></Button></Stack>}
  </Stack></Container>
}

function OwnerCollection({ id }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ attempt: null, collection: null, error: null })
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState({ key: null, places: [], error: null })
  const [pending, setPending] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [shareUrl, setShareUrl] = useState('')
  const busy = useRef(false)
  const collection = result.collection
  useEffect(() => {
    let cancelled = false
    getCollection(id)
      .then(({ collection }) => !cancelled && setResult({ attempt, collection, error: null }))
      .catch((error) => !cancelled && setResult({ attempt, collection: null, error }))
    return () => { cancelled = true }
  }, [id, attempt])
  useEffect(() => {
    if (!addOpen) return
    let cancelled = false
    getPlaces([], query)
      .then((places) => !cancelled && setSearch({ key: query, places, error: null }))
      .catch((error) => !cancelled && setSearch({ key: query, places: [], error }))
    return () => { cancelled = true }
  }, [query, addOpen])

  async function changePlace(place, remove = false) {
    if (busy.current) return
    busy.current = true
    setPending(`${remove ? 'remove' : 'add'}:${place.id}`)
    setFeedback(null)
    try {
      await (remove ? removeCollectionPlace(id, place.id) : addCollectionPlace(id, place.id))
      setResult((previous) => ({ ...previous, collection: { ...previous.collection, places: remove
        ? previous.collection.places.filter((row) => row.id !== place.id)
        : previous.collection.places.some((row) => row.id === place.id) ? previous.collection.places : [place, ...previous.collection.places] } }))
      setFeedback({ message: `${place.name} ${remove ? 'removed from' : 'added to'} collection.` })
    } catch (error) {
      setFeedback({ error: true, message: error.status === 401 ? 'Please log in again to update your collection.'
        : `Could not ${remove ? 'remove' : 'add'} this place. Please try again.` })
    } finally { busy.current = false; setPending('') }
  }
  async function share() {
    if (busy.current) return
    busy.current = true
    setPending('share')
    setFeedback(null)
    try {
      const { share_token } = await shareCollection(id)
      const url = `${window.location.origin}/collections/shared/${share_token}`
      setShareUrl(url)
      setResult((previous) => ({ ...previous, collection: { ...previous.collection, is_shared: true } }))
      try {
        await navigator.clipboard.writeText(url)
        setFeedback({ message: 'Share link copied. Anyone with the link can view this collection.' })
      } catch { setFeedback({ message: 'Share link ready. Copy it below to share your collection.' }) }
    } catch {
      setFeedback({ error: true, message: 'Could not create the share link. Please try again.' })
    } finally { busy.current = false; setPending('') }
  }

  if (result.attempt !== attempt) return <HStack role="status"><Spinner size="sm" /><Text>Loading collection…</Text></HStack>
  if (result.error) return <Stack align="start"><Heading size="xl">{result.error.status === 404 ? 'Collection not found' : 'Could not load collection'}</Heading><Text role="alert" color="fg.error">{result.error.status === 401 ? 'Please log in again.' : 'This collection is unavailable. Return to Account or retry.'}</Text><Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry collection</Button></Stack>
  const memberIds = new Set(collection.places.map((place) => place.id))
  return <Stack gap={5}>
    <HStack justify="space-between" align="start" gap={3}>
      <Stack gap={2} minW={0}><Heading size="3xl" overflowWrap="anywhere">{collection.name}</Heading>
        <HStack flexWrap="wrap"><Badge>{collection.is_shared ? 'Shared via link' : 'Private collection'}</Badge><Text color="fg.muted" fontSize="sm">{collection.places.length} {collection.places.length === 1 ? 'place' : 'places'}</Text></HStack>
      </Stack>
      <IconButton aria-label="Share collection" title="Share collection" variant="outline" colorPalette="blue"
        flexShrink={0} disabled={Boolean(pending)} loading={pending === 'share'} onClick={share}><LuShare2 /></IconButton>
    </HStack>
    {feedback && <Text role={feedback.error ? 'alert' : 'status'} color={feedback.error ? 'fg.error' : 'fg.success'}>{feedback.message}</Text>}
    {shareUrl && <Stack gap={2}><Text as="label" htmlFor="collection-share-link" fontSize="sm">Anyone with this link can view your collection.</Text><Input id="collection-share-link" aria-label="Collection share link" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /></Stack>}
    <Button alignSelf="start" colorPalette="blue" variant={addOpen ? 'outline' : 'solid'} onClick={() => setAddOpen((value) => !value)} aria-expanded={addOpen} aria-controls="collection-add-places">{addOpen ? 'Close place search' : 'Add places'}</Button>
    {addOpen && <Box id="collection-add-places" borderWidth="1px" rounded="xl" p={4}>
      <Stack gap={4}>
        <Heading size="lg">Find places to add</Heading>
        <PlaceSearch value={query} onChange={setQuery} />
        {search.key !== query ? <Spinner size="sm" /> : search.error ? <Text role="alert" color="fg.error">Could not search places. Change your search or reopen it to try again.</Text> : <>
          {!search.places.length && <Text color="fg.muted">No places match your search.</Text>}
          <Stack as="ul" aria-label="Places to add" listStyleType="none" p={0} m={0} gap={3}>
            {search.places.slice(0, 10).map((place) => <HStack as="li" key={place.id} justify="space-between" align="start" gap={3}>
              <Stack gap={1} minW={0}><Link asChild fontWeight="medium" overflowWrap="anywhere"><RouterLink to={`/places/${place.id}`}>{place.name}</RouterLink></Link><Text fontSize="xs" color="fg.muted">{place.address}</Text></Stack>
              <Button size="sm" flexShrink={0} variant="outline" disabled={Boolean(pending) || memberIds.has(place.id)}
                loading={pending === `add:${place.id}`} aria-label={memberIds.has(place.id) ? `${place.name} is in collection` : `Add ${place.name} to collection`}
                onClick={() => changePlace(place)}>{memberIds.has(place.id) ? 'Added' : 'Add'}</Button>
            </HStack>)}
          </Stack>
          {search.places.length > 10 && <Text fontSize="xs" color="fg.muted">Showing the first 10 matches. Search by name or area to narrow the results.</Text>}
        </>}
      </Stack>
    </Box>}
    <CollectionPlaces places={collection.places} pending={Boolean(pending)} onRemove={(place) => changePlace(place, true)} />
  </Stack>
}
