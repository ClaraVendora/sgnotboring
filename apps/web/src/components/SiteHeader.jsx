import { Link as RouterLink } from 'react-router-dom'
import { Box, Container, HStack, Image, Link, Text } from '@chakra-ui/react'
import { LuMapPin } from 'react-icons/lu'
import NavigationLinks from './NavigationLinks.jsx'

export default function SiteHeader({ activeTab }) {
  return (
    <Box as="header" bg="bg.panel" borderBottomWidth="1px">
      <Container maxW="6xl" px={{ base: 5, md: 8 }}>
        <HStack minH="80px" justify="space-between" gap={4}>
          <Link asChild textDecoration="none" _hover={{ textDecoration: 'none' }}>
            <RouterLink to="/">
              <HStack gap={3}>
                <Image src="/default-place.png" alt="" boxSize="42px" rounded="13px" objectFit="contain" flexShrink={0} />
                <Box>
                  <Text fontFamily="Georgia, serif" color="blue.fg" fontSize={{ base: '22px', md: '26px' }} fontWeight="bold" letterSpacing="-1px" lineHeight={1.1}>SG not boring.</Text>
                  <Text fontSize="9px" fontWeight="bold" color="fg.subtle" letterSpacing="1.8px" mt={1}>YOUR LOCAL DISCOVERY GUIDE</Text>
                </Box>
              </HStack>
            </RouterLink>
          </Link>
          <HStack as="nav" aria-label="Main navigation" display={{ base: 'none', md: 'flex' }} gap={1}>
            <NavigationLinks activeTab={activeTab} />
          </HStack>
          <HStack display={{ base: 'none', xl: 'flex' }} gap={2} color="blue.fg" bg="blue.subtle" rounded="full" px={3} py={2} fontSize="xs" fontWeight="semibold">
            <LuMapPin aria-hidden="true" />
            <Text>Singapore</Text>
          </HStack>
        </HStack>
      </Container>
    </Box>
  )
}
