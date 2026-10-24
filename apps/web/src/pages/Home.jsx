import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Container, Heading, HStack, SimpleGrid, Spinner, Stack, Text } from '@chakra-ui/react'
import { getPlaces, getTags } from '../lib/api.js'
import PlaceSearch from '../components/PlaceSearch.jsx'
import TagFilter from '../components/TagFilter.jsx'
import PlaceCard from '../components/PlaceCard.jsx'

// Selected tags live in the URL (?tags=Late%20Night,Spicy) so filtered views are
// shareable and the back button works. Search (?q=) replaces the current entry instead,
// so each pause while typing doesn't cost a Back press.
export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = (searchParams.get('tags') ?? '').split(',').filter(Boolean)

  const tagsKey = selected.join(',')
  const q = searchParams.get('q') ?? ''
  const resultKey = JSON.stringify([tagsKey, q])
  const updateParam = useCallback((name, value, options) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set(name, value)
      else next.delete(name)
      return next
    }, options)
  }, [setSearchParams])
  const search = useCallback((value) => updateParam('q', value, { replace: true }), [updateParam])

  const [tags, setTags] = useState([])
  const [tagsError, setTagsError] = useState(false)
  const [result, setResult] = useState({ key: null, places: null, error: null })
  const loading = result.key !== resultKey
  const { places, error } = loading ? { places: null, error: null } : result

  useEffect(() => {
    let cancelled = false
    getTags()
      .then((data) => !cancelled && setTags(data))
      .catch(() => !cancelled && setTagsError(true))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    getPlaces(tagsKey.split(',').filter(Boolean), q)
      .then((data) => !cancelled && setResult({ key: resultKey, places: data, error: null }))
      .catch((e) => !cancelled && setResult({ key: resultKey, places: null, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [tagsKey, q, resultKey])

  const toggle = (tag) => {
    const next = selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]
    updateParam('tags', next.join(','))
  }

  return (
    <Container maxW="6xl" py={{ base: 7, md: 10 }} px={{ base: 5, md: 8 }}>
      <Stack gap={7}>
        <Stack gap={2}>
          <Text color="blue.fg" fontSize="11px" fontWeight="bold" letterSpacing="1.6px" textTransform="uppercase">Discover Singapore</Text>
          <Heading size="3xl" letterSpacing="-1.1px" fontWeight="bold">SG is not boring</Heading>
          <Text color="fg.muted" fontSize="sm" lineHeight={1.7}>
            Discover food and experiences around Singapore, curated so you don't have to dig.
          </Text>
        </Stack>

        <Box bg="bg.panel" borderWidth="1px" rounded="13px" p={{ base: 4, md: 5 }}>
          <Stack gap={4}>
            <PlaceSearch value={q} onChange={search} />
            <Text fontSize="10px" color="fg.subtle" fontWeight="bold" letterSpacing="1.4px" textTransform="uppercase">Explore by tag</Text>
            {tagsError && <Text role="alert" color="fg.error">Could not load tag filters. Refresh to try again.</Text>}
            <TagFilter tags={tags} selected={selected} onToggle={toggle} onClear={() => updateParam('tags', '')} />
          </Stack>
        </Box>

        <HStack justify="space-between" gap={3}>
          <Heading size="lg" letterSpacing="-0.3px">Places to explore</Heading>
          <Text role="status" aria-live="polite" fontSize="xs" color="fg.muted" textAlign="right">
            {loading
              ? 'Loading food places…'
              : places ? `${places.length} food ${places.length === 1 ? 'place' : 'places'}` : 'Could not load food places'}
          </Text>
        </HStack>
        {error && <Text color="fg.error">Couldn't load places: {error}</Text>}
        {loading && <Spinner />}
        {places?.length === 0 && (
          <Text color="fg.muted">
            {q || selected.length ? 'No food places match your search and filters.' : 'No food places to show yet.'}
          </Text>
        )}
        {places?.length > 0 && (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {places.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  )
}
