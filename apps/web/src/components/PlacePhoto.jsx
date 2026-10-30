import { useState } from 'react'
import { Box, Image, Stack, Text } from '@chakra-ui/react'
import { LuImage } from 'react-icons/lu'

export default function PlacePhoto({ src, name, loading = 'lazy', compact = false }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const hasPhoto = Boolean(src && failedUrl !== src)
  return (
    <Box aspectRatio={compact ? 1 : 16 / 9} width={compact ? '64px' : 'full'}
      height={compact ? '64px' : undefined} flexShrink={0} overflow="hidden" bg="bg.muted"
      rounded={compact ? 'md' : undefined}>
      {hasPhoto ? <Image src={src} alt={`Photo of ${name}`} width="full" height="full"
        objectFit="cover" loading={loading} decoding="async" referrerPolicy="no-referrer"
        onError={() => setFailedUrl(src)} /> :
        <Stack h="full" align="center" justify="center" gap={2} color="fg.subtle"
          role="img" aria-label={`No photo available for ${name}`}>
          <LuImage size={compact ? 22 : 30} aria-hidden="true" />
          {!compact && <Text fontSize="xs">No photo available</Text>}
        </Stack>}
    </Box>
  )
}
