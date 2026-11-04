import { Box, IconButton, Stack, Text } from '@chakra-ui/react'
import { LuTrash2 } from 'react-icons/lu'
import PlaceCard from './PlaceCard.jsx'

export default function CollectionPlaces({ places, onRemove, pending }) {
  if (!places.length) return <Text color="fg.muted">No places in this collection yet.</Text>
  return <Stack as="ul" aria-label="Places in collection" listStyleType="none" p={0} m={0} gap={4}>
    {places.map((place) => <Box as="li" key={place.id}>
      <PlaceCard place={place} compact action={onRemove && (
        <IconButton variant="ghost" colorPalette="red" minW="44px" minH="44px" disabled={pending}
          position="relative" zIndex={1} aria-label={`Remove ${place.name} from collection`}
          title="Remove from collection" onClick={() => onRemove(place)}><LuTrash2 aria-hidden="true" /></IconButton>
      )} />
    </Box>)}
  </Stack>
}
