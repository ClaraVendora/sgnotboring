import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Card, Heading, HStack, Input, Link, Spinner, Stack, Text } from '@chakra-ui/react'
import { LuFolder } from 'react-icons/lu'

export default function CollectionsCard({ collections, loading, error, pending, createError, onCreate, onRetry }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [validation, setValidation] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (!name.trim()) { setValidation('Enter a collection name.'); return }
    setValidation('')
    if (await onCreate(name.trim())) { setName(''); setCreating(false) }
  }
  return (
    <Card.Root as="section" aria-labelledby="collections-heading" rounded="xl" minW={0}>
      <Card.Body gap={4} minW={0}>
        <HStack justify="space-between" flexWrap="wrap">
          <Heading id="collections-heading" size="xl">Collections</Heading>
          <Button size="sm" variant="outline" colorPalette="blue" disabled={loading || error || pending}
            onClick={() => setCreating(true)}>New collection</Button>
        </HStack>
        <Text fontSize="sm" color="fg.muted">Organise places into your own lists, then share a collection with friends.</Text>
        {loading && <HStack role="status"><Spinner size="sm" /><Text>Loading collections…</Text></HStack>}
        {error && <Stack align="start"><Text role="alert" color="fg.error">Could not load collections. Please try again.</Text><Button variant="outline" onClick={onRetry}>Retry collections</Button></Stack>}
        {!loading && !error && <>
          {creating && <Stack as="form" onSubmit={submit} gap={3}>
            <Text as="label" htmlFor="collection-name" fontWeight="medium">Collection name</Text>
            <Input id="collection-name" value={name} maxLength={80} required disabled={pending}
              placeholder="e.g. Weekend cafes" onChange={(event) => { setName(event.target.value); setValidation('') }} />
            {validation && <Text role="alert" color="fg.error">{validation}</Text>}
            <HStack>
              <Button type="submit" colorPalette="blue" loading={pending} disabled={pending}>Create collection</Button>
              <Button variant="ghost" type="button" disabled={pending} onClick={() => setCreating(false)}>Cancel</Button>
            </HStack>
          </Stack>}
          {createError && <Text role="alert" color="fg.error">{createError}</Text>}
          {!collections.length && <Text color="fg.muted">No collections yet. Create one to start adding places.</Text>}
          {collections.length > 0 && <HStack as="ul" aria-label="Your collections" tabIndex={0} listStyleType="none"
            p={1} m={0} pb={3} gap={3} align="stretch" width="full" overflowX="auto" scrollSnapType="x proximity">
            {collections.map((collection) => <Box as="li" key={collection.id} flex="0 0 190px" minW={0} scrollSnapAlign="start">
              <Link asChild display="flex" flexDirection="column" alignItems="start" gap={3} height="full" width="full"
                p={4} rounded="lg" borderWidth="1px" textDecoration="none" colorPalette="blue"
                _hover={{ bg: 'blue.subtle', borderColor: 'blue.muted' }}
                aria-label={collection.name} aria-describedby={`collection-count-${collection.id}`}>
                <RouterLink to={`/profile/collections/${collection.id}`}>
                  <Box color="blue.fg" bg="blue.subtle" p={3} rounded="lg"><LuFolder size={24} aria-hidden="true" /></Box>
                  <Text fontWeight="semibold" overflowWrap="anywhere" lineClamp={2}>{collection.name}</Text>
                  <Text id={`collection-count-${collection.id}`} fontSize="sm" color="fg.muted">{collection.place_count} {collection.place_count === 1 ? 'place' : 'places'}</Text>
                </RouterLink>
              </Link>
            </Box>)}
          </HStack>}
        </>}
      </Card.Body>
    </Card.Root>
  )
}
