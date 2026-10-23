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
      bg="bg"
      borderTopWidth="1px"
      pb="env(safe-area-inset-bottom)"
    >
      <Flex maxW="lg" mx="auto" h={NAV_HEIGHT}>
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
            _hover={{ textDecoration: 'none', color: 'fg' }}
            _currentPage={{ color: 'teal.fg' }}
          >
            <NavLink to={to} end={end}>
              <Icon as={icon} boxSize={6} />
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
