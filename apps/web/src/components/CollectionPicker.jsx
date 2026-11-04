import { Link as RouterLink } from 'react-router-dom'
import { Button, HStack, IconButton, Link, Popover, Portal, Spinner, Stack, Text } from '@chakra-ui/react'
import { LuCheck } from 'react-icons/lu'
import { FaBookmark, FaRegBookmark } from 'react-icons/fa'

export default function CollectionPicker({ name, open, authLoading, signedIn, collections, loading, error,
  bookmarked, bookmarkPending, disabled, onRemove, pendingId, feedback, onOpenChange, onSelect, onRetry }) {
  const button = <IconButton aria-label={bookmarked ? `Remove ${name} from all collections` : `Add ${name} to a collection`}
    aria-pressed={Boolean(bookmarked)} aria-busy={Boolean(bookmarkPending)}
    title={bookmarked ? 'Remove from all collections' : 'Add to collection'}
    variant={bookmarked ? 'subtle' : 'outline'} colorPalette={bookmarked ? 'blue' : 'gray'}
    disabled={authLoading || disabled || bookmarkPending} loading={bookmarkPending}
    onClick={bookmarked ? onRemove : undefined}
    rounded="full" minW="44px" minH="44px" position="relative" zIndex={1}>
    {bookmarked ? <FaBookmark /> : <FaRegBookmark />}
  </IconButton>
  return <Popover.Root open={open && !bookmarked} onOpenChange={({ open }) => onOpenChange(open)}
    positioning={{ placement: 'bottom-end', gutter: 8 }} lazyMount unmountOnExit>
    {bookmarked ? button : <Popover.Trigger asChild>{button}</Popover.Trigger>}
    <Portal>
      <Popover.Positioner>
        <Popover.Content aria-label="Choose a collection" width="280px" maxW="calc(100vw - 24px)" rounded="xl" shadow="lg">
          <Popover.Header><Popover.Title fontSize="sm" fontWeight="semibold">Choose a collection</Popover.Title></Popover.Header>
          <Popover.Body pt={0}>
            {authLoading || loading ? <HStack role="status"><Spinner size="sm" /><Text fontSize="sm">Loading collections…</Text></HStack>
              : !signedIn ? <Stack gap={2}><Text fontSize="sm">Log in to add places to a collection.</Text><Link asChild colorPalette="blue"><RouterLink to="/profile">Log in</RouterLink></Link></Stack>
              : error ? <Stack gap={2} align="start"><Text role="alert" color="fg.error" fontSize="sm">Could not load collections.</Text><Button size="sm" variant="outline" onClick={onRetry}>Retry collections</Button></Stack>
              : <Stack gap={3}>
                {!collections.length && <Text fontSize="sm" color="fg.muted">No collections yet.</Text>}
                <Stack gap={1} maxH="240px" overflowY="auto">
                  {collections.map((collection) => <Button key={collection.id} variant="ghost" justifyContent="space-between"
                    height="auto" minH="44px" py={2} whiteSpace="normal" textAlign="left"
                    disabled={Boolean(pendingId) || collection.contains_place} loading={pendingId === collection.id}
                    aria-label={collection.contains_place ? `${collection.name} — Added` : `Add to ${collection.name}`}
                    onClick={() => onSelect(collection)}>
                    <Text minW={0} overflowWrap="anywhere">{collection.name}</Text>
                    {collection.contains_place && <HStack flexShrink={0} gap={1} fontSize="xs"><LuCheck aria-hidden="true" />Added</HStack>}
                  </Button>)}
                </Stack>
                {feedback && <Text role={feedback.error ? 'alert' : 'status'} fontSize="sm" color={feedback.error ? 'fg.error' : 'fg.success'}>{feedback.message}</Text>}
                <Link asChild fontSize="sm" colorPalette="blue"><RouterLink to="/profile">{collections.length ? 'Manage collections' : 'Create a collection'}</RouterLink></Link>
              </Stack>}
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Portal>
  </Popover.Root>
}
