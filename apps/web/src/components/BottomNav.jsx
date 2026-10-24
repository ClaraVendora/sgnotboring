import { NavLink } from 'react-router-dom'
import { Box, Flex, Icon, Link, Text } from '@chakra-ui/react'
import { LuCompass, LuSparkles, LuUserRound } from 'react-icons/lu'

// Height of the bar itself; the iOS home-indicator inset is added on top of it.
export const NAV_HEIGHT = '64px'

const TABS = [
  { to: '/', label: 'Discover', icon: LuCompass, end: true },
  { to: '/ask', label: 'Ask', icon: LuSparkles },
  { to: '/profile', label: 'Account', icon: LuUserRound },
]

// Mobile-first tab bar fixed to the bottom. NavLink marks the active tab with
// aria-current="page", which `_currentPage` styles.
export default function BottomNav() {
  return (
    <Box
      as="nav"
      aria-label="Main navigation"
      position="fixed"
      bottom={0}
      insetX={0}
      zIndex="sticky"
      bg="bg.panel"
      borderTopWidth="1px"
      pb="env(safe-area-inset-bottom)"
    >
      <Flex maxW="lg" mx="auto" h={NAV_HEIGHT} gap={2} px={3} py={2}>
        {TABS.map(({ to, label, icon, end }) => (
          <Link
            key={to}
            asChild
            flex="1"
            flexDirection="column"
            justifyContent="center"
            gap={0.5}
            color="fg.muted"
            textDecoration="none"
            rounded="9px"
            _hover={{ textDecoration: 'none', color: 'blue.fg', bg: 'blue.subtle' }}
            _currentPage={{ color: 'blue.fg', bg: 'blue.subtle' }}
          >
            <NavLink to={to} end={end}>
              <Icon as={icon} boxSize={5} />
              <Text fontSize="xs" fontWeight="medium">
                {label}
              </Text>
            </NavLink>
          </Link>
        ))}
      </Flex>
    </Box>
  )
}
