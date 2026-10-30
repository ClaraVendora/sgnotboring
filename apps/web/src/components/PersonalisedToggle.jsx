import { Link as RouterLink } from 'react-router-dom'
import { Icon, Link, Stack, Switch, Text } from '@chakra-ui/react'
import { LuHeart, LuLock } from 'react-icons/lu'

const row = { display: 'flex', alignItems: 'center', borderWidth: '1px', rounded: 'xl', px: 4, py: 3, gap: 3, w: 'full', bg: 'bg.panel' }

function Copy({ title, detail }) {
  return (
    <Stack gap={0} flex="1" minW={0}>
      <Text fontWeight="semibold" fontSize="sm">{title}</Text>
      <Text fontSize="xs" color="fg.muted">{detail}</Text>
    </Stack>
  )
}

// The Personalised row on AI Search. Guests (and expired logins) see it locked; tapping it goes
// to `loginTo`.
export default function PersonalisedToggle({ loggedIn, expired = false, checked, onChange, loginTo = '/profile' }) {
  if (!loggedIn || expired) {
    return (
      <Link asChild {...row} color="fg" textDecoration="none" _hover={{ bg: 'bg.muted', textDecoration: 'none' }}>
        <RouterLink to={loginTo}>
          <Icon as={LuHeart} color="fg.subtle" boxSize={5} />
          <Copy title="Personalised" detail={expired
            ? 'Off: your login has expired. Log in again to use your saved places and preferences'
            : 'Log in to use your saved places and preferences'} />
          <Icon as={LuLock} color="fg.subtle" boxSize={4} />
        </RouterLink>
      </Link>
    )
  }
  return (
    <Switch.Root {...row} checked={checked} onCheckedChange={(event) => onChange(event.checked)}
      colorPalette="pink" cursor="pointer">
      <Switch.HiddenInput />
      <Icon as={LuHeart} color={checked ? 'pink.fg' : 'fg.subtle'} boxSize={5} />
      <Switch.Label flex="1" minW={0}>
        <Copy title="Personalised"
          detail={checked ? 'Using your saved places and survey answers' : 'Results are the same as for guests'} />
      </Switch.Label>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch.Root>
  )
}
