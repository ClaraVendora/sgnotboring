import { Link as RouterLink } from 'react-router-dom'
import { Icon, Link, Text } from '@chakra-ui/react'
import { LuCompass, LuSparkles, LuUserRound } from 'react-icons/lu'

const TABS = [
  { to: '/', label: 'Discover', icon: LuCompass },
  { to: '/ask', label: 'Ask', icon: LuSparkles },
  { to: '/profile', label: 'Account', icon: LuUserRound },
]

// Both navigation bars use the same destinations and active state from the app shell.
// The active tab is the current page only on its own route; on a sub-page (e.g. the survey)
// it marks the current section instead.
export default function NavigationLinks({ activeTab, path, compact = false }) {
  return TABS.map(({ to, label, icon }) => (
    <Link key={to} asChild flex={compact ? '1' : undefined}
      flexDirection={compact ? 'column' : 'row'} justifyContent="center"
      gap={compact ? 0.5 : 2} px={compact ? 2 : 4} minH="44px"
      color={activeTab === to ? 'blue.fg' : 'fg.muted'} bg={activeTab === to ? 'blue.subtle' : undefined}
      textDecoration="none" rounded="9px"
      _hover={{ textDecoration: 'none', color: 'blue.fg', bg: 'blue.subtle' }}>
      <RouterLink to={to} aria-current={activeTab === to ? (path === to ? 'page' : 'true') : undefined}>
        <Icon as={icon} boxSize={5} aria-hidden="true" />
        <Text fontSize={compact ? 'xs' : 'sm'} fontWeight="semibold">{label}</Text>
      </RouterLink>
    </Link>
  ))
}
