import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Container, Heading, SimpleGrid, Spinner, Stack, Text } from '@chakra-ui/react'
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
    <Container maxW="6xl" py={10}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading size="3xl">SG is not boring</Heading>
          <Text color="fg.muted">
            Discover food and experiences around Singapore, curated so you don't have to dig.
          </Text>
        </Stack>

        <PlaceSearch value={q} onChange={search} />
        {tagsError && <Text role="alert" color="fg.error">Could not load tag filters. Refresh to try again.</Text>}
        <TagFilter tags={tags} selected={selected} onToggle={toggle} onClear={() => updateParam('tags', '')} />

        <Text role="status" aria-live="polite">
          {loading
            ? 'Loading food places…'
            : places ? `${places.length} food ${places.length === 1 ? 'place' : 'places'}` : 'Could not load food places'}
        </Text>
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
