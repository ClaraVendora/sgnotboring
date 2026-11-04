import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Button, Container, Heading, HStack, NativeSelect, SimpleGrid, Spinner, Stack, Text } from '@chakra-ui/react'
import { addCollectionPlace, getCollectionBookmarks, getCollections, getPlaces, getTags, removePlaceFromCollections } from '../lib/api.js'
import PlaceSearch from '../components/PlaceSearch.jsx'
import TagFilter from '../components/TagFilter.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import QuickFilters from '../components/QuickFilters.jsx'
import SaveFeedback from '../components/SaveFeedback.jsx'
import { useCurrentMinute } from '../hooks/useOpenStatus.js'
import { useSavedPlaces } from '../hooks/useSavedPlaces.js'
import { filterOpenPlaces, sortPlaces } from '../lib/place-filters.js'
import { useSession } from '../hooks/useSession.js'

// Selected tags live in the URL (?tags=Late%20Night,Spicy) so filtered views are
// shareable and the back button works. Search (?q=) replaces the current entry instead,
// so each pause while typing doesn't cost a Back press.
export default function Home() {
  const saves = useSavedPlaces()
  const { session, loading: authLoading } = useSession()
  const userId = session?.user.id ?? 'guest'
  const [bookmarkAttempt, setBookmarkAttempt] = useState(0)
  const [bookmarks, setBookmarks] = useState({ key: null, placeIds: [], error: null })
  const [bookmarkFeedback, setBookmarkFeedback] = useState(null)
  const [removingBookmark, setRemovingBookmark] = useState(null)
  const bookmarkKey = `${userId}:${bookmarkAttempt}`
  const bookmarksLoading = Boolean(session) && bookmarks.key !== bookmarkKey
  const bookmarkError = Boolean(session) && !bookmarksLoading && bookmarks.error
  const bookmarkedIds = new Set(!bookmarksLoading && bookmarks.key === bookmarkKey ? bookmarks.placeIds : [])
  const [picker, setPicker] = useState({ userId: null, placeId: null, version: 0 })
  const [pickerResult, setPickerResult] = useState({ key: null, collections: [], error: null })
  const [pickerAction, setPickerAction] = useState({ key: null })
  const collectionBusy = useRef(false)
  const pickerPlaceId = picker.userId === userId ? picker.placeId : null
  const pickerKey = `${userId}:${pickerPlaceId}:${picker.version}`
  const pickerLoading = pickerResult.key !== pickerKey
  const action = pickerAction.key === pickerKey ? pickerAction : {}

  useEffect(() => {
    if (userId === 'guest') return
    let cancelled = false
    getCollectionBookmarks()
      .then(({ place_ids }) => !cancelled && setBookmarks({ key: bookmarkKey, placeIds: place_ids, error: null }))
      .catch((error) => !cancelled && setBookmarks({ key: bookmarkKey, placeIds: [], error }))
    return () => { cancelled = true }
  }, [userId, bookmarkKey])

  async function removeBookmark(place) {
    if (collectionBusy.current || !session) return
    collectionBusy.current = true
    setRemovingBookmark({ userId, placeId: place.id })
    setBookmarkFeedback(null)
    setPicker((previous) => ({ ...previous, placeId: null }))
    try {
      await removePlaceFromCollections(place.id)
      setBookmarks((previous) => previous.key !== bookmarkKey ? previous : { ...previous, placeIds: previous.placeIds.filter((id) => id !== place.id) })
      setBookmarkFeedback({ userId, message: `${place.name} removed from all your collections.` })
    } catch (error) {
      // Reconcile in case a large collection list was only partially removed.
      try {
        const { place_ids } = await getCollectionBookmarks()
        setBookmarks((previous) => previous.key !== bookmarkKey ? previous : { ...previous, placeIds: place_ids })
      } catch { /* Keep the last known state until the user retries. */ }
      setBookmarkFeedback({ userId, error: true, message: error.status === 401
        ? 'Please log in again to update your collections.' : 'Could not remove this place from all collections. Please try again.' })
    } finally { collectionBusy.current = false; setRemovingBookmark(null) }
  }

  useEffect(() => {
    if (!pickerPlaceId || !session) return
    let cancelled = false
    getCollections(pickerPlaceId)
      .then(({ collections }) => !cancelled && setPickerResult({ key: pickerKey, collections, error: null }))
      .catch((error) => !cancelled && setPickerResult({ key: pickerKey, collections: [], error }))
    return () => { cancelled = true }
  }, [pickerPlaceId, pickerKey, session])

  async function addToCollection(collection) {
    if (collectionBusy.current || !pickerPlaceId || !session) return
    collectionBusy.current = true
    setPickerAction({ key: pickerKey, pendingId: collection.id })
    try {
      await addCollectionPlace(collection.id, pickerPlaceId)
      setBookmarks((previous) => previous.key !== bookmarkKey ? previous : { ...previous,
        placeIds: [...new Set([...previous.placeIds, pickerPlaceId])],
      })
      setPickerResult((previous) => previous.key !== pickerKey ? previous : { ...previous,
        collections: previous.collections.map((row) => row.id === collection.id ? { ...row, contains_place: true } : row),
      })
      setPickerAction({ key: pickerKey, feedback: { message: `Added to ${collection.name}.` } })
      setBookmarkFeedback({ userId, message: `Added to ${collection.name}.` })
      setPicker((previous) => previous.userId === userId && previous.placeId === pickerPlaceId ? { ...previous, placeId: null } : previous)
    } catch (error) {
      setPickerAction({ key: pickerKey, feedback: { error: true, message: error.status === 401
        ? 'Please log in again to add this place.' : 'Could not add this place. Please try again.' } })
    } finally { collectionBusy.current = false }
  }
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = (searchParams.get('tags') ?? '').split(',').filter(Boolean)

  const tagsKey = selected.join(',')
  const q = searchParams.get('q') ?? ''
  const openNow = searchParams.get('open_now') === '1'
  const sort = ['az', 'za'].includes(searchParams.get('sort')) ? searchParams.get('sort') : 'recommended'
  const rowsPerPage = [10, 20, 30].includes(Number(searchParams.get('rows_per_page')))
    ? Number(searchParams.get('rows_per_page')) : 10
  // Use the desktop three-column grid to define a row, keeping page contents
  // stable when the responsive layout switches to one or two columns.
  const pageSize = rowsPerPage * 3
  const requestedPage = Number(searchParams.get('page') ?? 1)
  const resultsHeading = useRef(null)
  const minute = useCurrentMinute()
  const [moreFilters, setMoreFilters] = useState(false)
  const resultKey = JSON.stringify([tagsKey, q])
  const updateParam = useCallback((name, value, options) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (name !== 'page') next.delete('page')
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
  const { places: fetchedPlaces, error } = loading ? { places: null, error: null } : result
  const places = fetchedPlaces && sortPlaces(filterOpenPlaces(fetchedPlaces, openNow, new Date(minute)), sort)
  const totalPages = Math.max(1, Math.ceil((places?.length ?? 0) / pageSize))
  const page = Math.min(totalPages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1)
  const first = (page - 1) * pageSize
  const visiblePlaces = places?.slice(first, first + pageSize)
  const pageNumbers = [...new Set([1, ...Array.from({ length: 5 }, (_, index) => page - 2 + index), totalPages])]
    .filter((number) => number >= 1 && number <= totalPages).sort((a, b) => a - b)
  const changePage = (number) => {
    updateParam('page', number === 1 ? '' : String(number))
    resultsHeading.current?.focus({ preventScroll: true })
    resultsHeading.current?.scrollIntoView({ block: 'start' })
  }

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
            <QuickFilters selected={selected} openNow={openNow} onToggleTag={toggle}
              onToggleOpenNow={() => updateParam('open_now', openNow ? '' : '1')} />
            <HStack gap={3}>
              <Button size="sm" variant="ghost" onClick={() => setMoreFilters((value) => !value)}
                aria-expanded={moreFilters} aria-controls="all-tag-filters">
                More filters{selected.length ? ` (${selected.length} selected)` : ''}
              </Button>
              {(selected.length > 0 || openNow) && <Button size="sm" variant="ghost" onClick={() => {
                setSearchParams((previous) => {
                  const next = new URLSearchParams(previous)
                  next.delete('tags')
                  next.delete('open_now')
                  next.delete('page')
                  return next
                })
              }}>Clear filters</Button>}
            </HStack>
            {tagsError && <Text role="alert" color="fg.error">Could not load tag filters. Refresh to try again.</Text>}
            <Box id="all-tag-filters" hidden={!moreFilters}>
              <TagFilter tags={[...new Set([...tags, ...selected])].sort()} selected={selected}
                onToggle={toggle} onClear={() => updateParam('tags', '')} />
            </Box>
          </Stack>
        </Box>

        <Stack gap={3} pt={2}>
          <HStack justify="flex-end" gap={4} flexWrap="wrap">
            <HStack gap={2}>
              <Text as="label" htmlFor="places-sort" fontSize="sm" color="fg.muted">Sort by</Text>
              <NativeSelect.Root size="sm" width="150px">
                <NativeSelect.Field id="places-sort" value={sort} onChange={(event) => updateParam('sort', event.target.value === 'recommended' ? '' : event.target.value)}>
                  <option value="recommended">Recommended</option>
                  <option value="az">A–Z</option>
                  <option value="za">Z–A</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </HStack>
            <HStack gap={2}>
              <Text as="label" htmlFor="places-page-size" fontSize="sm" color="fg.muted">Rows per page</Text>
              <NativeSelect.Root size="sm" width="80px">
                <NativeSelect.Field id="places-page-size" value={rowsPerPage}
                  onChange={(event) => updateParam('rows_per_page', event.target.value)}>
                  {[10, 20, 30].map((size) => <option key={size} value={size}>{size}</option>)}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </HStack>
          </HStack>
           <HStack justify="space-between" align="end" gap={3} flexWrap="wrap" mt={-1}>
            <Heading ref={resultsHeading} tabIndex={-0} scrollMarginTop="3" size="xl" letterSpacing="-0.3px">Places to visit</Heading>
            <Text role="status" aria-live="polite" fontSize="xs" color="fg.muted" textAlign="right">
              {loading
                ? 'Loading food places…'
                : places?.length ? `Showing ${first + 1}–${Math.min(first + pageSize, places.length)} of ${places.length} food places` : places ? '0 food places' : 'Could not load food places'}
            </Text>
          </HStack>
          {error && <Text color="fg.error">Couldn't load places: {error}</Text>}
          <SaveFeedback feedback={saves.feedback} loadError={saves.loadError} onDismiss={saves.dismiss} onRetry={saves.retry} />
          {bookmarkError && <HStack flexWrap="wrap"><Text role="alert" color="fg.error">Could not load collection bookmarks.</Text><Button size="sm" variant="outline" onClick={() => setBookmarkAttempt((value) => value + 1)}>Retry bookmarks</Button></HStack>}
          {bookmarkFeedback?.userId === userId && <Text role={bookmarkFeedback.error ? 'alert' : 'status'} color={bookmarkFeedback.error ? 'fg.error' : 'fg.success'}>{bookmarkFeedback.message}</Text>}
          {loading && <Spinner />}
          {places?.length === 0 && (
            <Text color="fg.muted">
              {openNow ? 'No matching food places are open now. Try another area or turn off Open now.' :
                q || selected.length ? 'No food places match your search and filters.' : 'No food places to show yet.'}
            </Text>
          )}
          {places?.length > 0 && (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {visiblePlaces.map((p) => (
                <PlaceCard key={p.id} place={p} save={saves.buttonProps(p)} collection={{
                  open: pickerPlaceId === p.id, authLoading, signedIn: Boolean(session),
                  bookmarked: bookmarkedIds.has(p.id),
                  bookmarkPending: removingBookmark?.userId === userId && removingBookmark?.placeId === p.id,
                  disabled: bookmarksLoading || Boolean(bookmarkError), onRemove: () => removeBookmark(p),
                  collections: pickerLoading ? [] : pickerResult.collections,
                  loading: Boolean(session) && pickerLoading,
                  error: !pickerLoading && Boolean(pickerResult.error),
                  pendingId: action.pendingId, feedback: action.feedback,
                  onOpenChange: (open) => setPicker((previous) => open
                    ? { userId, placeId: p.id, version: previous.version + 1 }
                    : previous.placeId === p.id ? { ...previous, placeId: null } : previous),
                  onSelect: addToCollection,
                  onRetry: () => setPicker((previous) => ({ ...previous, version: previous.version + 1 })),
                }} />
              ))}
            </SimpleGrid>
          )}
          {places?.length > 0 && (
            <Stack as="nav" aria-label="Places pagination" align="center" gap={3}>
              <Text fontSize="sm" color="fg.muted">Page {page} of {totalPages}</Text>
              <HStack gap={1} flexWrap="wrap" justify="center">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</Button>
                {pageNumbers.map((number, index) => (
                  <HStack key={number} gap={1}>
                    {index > 0 && number - pageNumbers[index - 1] > 1 && <Text px={1} aria-hidden="true">…</Text>}
                    <Button size="sm" variant={number === page ? 'solid' : 'ghost'} colorPalette="blue"
                      aria-label={`Go to page ${number}`} aria-current={number === page ? 'page' : undefined}
                      onClick={() => changePage(number)}>{number}</Button>
                  </HStack>
                ))}
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => changePage(page + 1)}>Next</Button>
              </HStack>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Container>
  )
}
