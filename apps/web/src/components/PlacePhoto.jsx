import { useState } from 'react'
import { Box, Image } from '@chakra-ui/react'

export default function PlacePhoto({ src, name, loading = 'lazy' }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const hasPhoto = Boolean(src && failedUrl !== src)
  return (
    <Box aspectRatio={16 / 9} overflow="hidden" bg="bg.muted">
      <Image
        src={hasPhoto ? src : '/default-place.png'}
        alt={hasPhoto ? `Photo of ${name}` : 'SG not boring — default place image'}
        width="full"
        height="full"
        objectFit="cover"
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={hasPhoto ? () => setFailedUrl(src) : undefined}
      />
    </Box>
  )
}
