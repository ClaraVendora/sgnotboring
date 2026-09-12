import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Container, Heading, SimpleGrid, Spinner, Stack, Text } from '@chakra-ui/react'
import { getPlaces, getTags } from '../lib/api.js'
import TagFilter from '../components/TagFilter.jsx'
import PlaceCard from '../components/PlaceCard.jsx'

// Selected tags live in the URL (?tags=Late%20Night,Spicy) so filtered views are
// shareable and the back button works.
export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = (searchParams.get('tags') ?? '').split(',').filter(Boolean)

  const tagsKey = selected.join(',')

  const [tags, setTags] = useState([])
  const [result, setResult] = useState({ key: null, places: null, error: null })
  const loading = result.key !== tagsKey
  const { places, error } = loading ? { places: null, error: null } : result

  useEffect(() => {
    getTags().then(setTags).catch(() => setTags([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    getPlaces(tagsKey.split(',').filter(Boolean))
      .then((data) => !cancelled && setResult({ key: tagsKey, places: data, error: null }))
      .catch((e) => !cancelled && setResult({ key: tagsKey, places: null, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [tagsKey])

  const toggle = (tag) => {
    const next = selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]
    setSearchParams(next.length ? { tags: next.join(',') } : {})
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

        <TagFilter tags={tags} selected={selected} onToggle={toggle} onClear={() => setSearchParams({})} />

        {error && <Text color="fg.error">Couldn't load places: {error}</Text>}
        {loading && <Spinner />}
        {places?.length === 0 && <Text color="fg.muted">Nothing matches those tags yet.</Text>}
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
