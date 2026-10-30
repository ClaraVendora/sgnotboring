import { Link as RouterLink } from 'react-router-dom'
import { Icon, Link, Text } from '@chakra-ui/react'
import { LuCompass, LuSparkles, LuUserRound } from 'react-icons/lu'

const TABS = [
  { to: '/', label: 'Discover', icon: LuCompass },
  { to: '/ask', label: 'Ask', icon: LuSparkles },
  { to: '/profile', label: 'Account', icon: LuUserRound },
]

// Both navigation bars use the same destinations and active state from the app shell.
export default function NavigationLinks({ activeTab, compact = false }) {
  return TABS.map(({ to, label, icon }) => (
    <Link key={to} asChild flex={compact ? '1' : undefined}
      flexDirection={compact ? 'column' : 'row'} justifyContent="center"
      gap={compact ? 0.5 : 2} px={compact ? 2 : 4} minH="44px"
      color="fg.muted" textDecoration="none" rounded="9px"
      _hover={{ textDecoration: 'none', color: 'blue.fg', bg: 'blue.subtle' }}
      _currentPage={{ color: 'blue.fg', bg: 'blue.subtle' }}>
      <RouterLink to={to} aria-current={activeTab === to ? 'page' : undefined}>
        <Icon as={icon} boxSize={5} aria-hidden="true" />
        <Text fontSize={compact ? 'xs' : 'sm'} fontWeight="semibold">{label}</Text>
      </RouterLink>
    </Link>
  ))
}
