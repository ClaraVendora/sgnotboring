import { Box, Flex } from '@chakra-ui/react'
import NavigationLinks from './NavigationLinks.jsx'

// Height of the bar itself; the iOS home-indicator inset is added on top of it.
export const NAV_HEIGHT = '64px'

// Hidden (including from the keyboard/accessibility tree) at the desktop breakpoint.
export default function BottomNav({ activeTab }) {
  return (
    <Box
      as="nav"
      aria-label="Main navigation"
      display={{ base: 'block', md: 'none' }}
      position="fixed"
      bottom={0}
      insetX={0}
      zIndex="sticky"
      bg="bg.panel"
      borderTopWidth="1px"
      pb="env(safe-area-inset-bottom)"
    >
      <Flex maxW="lg" mx="auto" h={NAV_HEIGHT} gap={2} px={3} py={2}>
        <NavigationLinks activeTab={activeTab} compact />
      </Flex>
    </Box>
  )
}
