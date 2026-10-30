import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Badge, Box, Button, Container, Flex, Heading, HStack, Link, Spinner, Stack, Text, Wrap } from '@chakra-ui/react'
import { LuHeart, LuRotateCcw } from 'react-icons/lu'
import AskComposer from '../components/AskComposer.jsx'
import AskErrorAlert from '../components/AskErrorAlert.jsx'
import ChatBubble from '../components/ChatBubble.jsx'
import PersonalisedToggle from '../components/PersonalisedToggle.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import SaveFeedback from '../components/SaveFeedback.jsx'
import { useSavedPlaces } from '../hooks/useSavedPlaces.js'
import { useAsk } from '../hooks/useAsk.js'

const SUGGESTIONS = [
  'Cheap supper for 6 after midnight',
  'Quiet cafe in Tiong Bahru open now',
  'Atas date night with good cocktails',
  'Halal food near Bugis',
]

// Under a reply when Personalised was on but not used for it.
function PersonalisationNote({ status }) {
  if (status === 'empty') {
    return <Text fontSize="sm" color="fg.muted">Save places you like and Personalised will lean on them in future searches.</Text>
  }
  if (status === 'logged_out') {
    return (
      <Text fontSize="sm" color="fg.muted">
        Personalisation is off because your login has expired.{' '}
        <Link asChild colorPalette="blue"><RouterLink to="/profile">Log in again</RouterLink></Link>
      </Text>
    )
  }
  if (status === 'unavailable') {
    return <Text fontSize="sm" color="fg.muted">Couldn't load your saved places and survey answers, so these results aren't personalised.</Text>
  }
  return null
}

// Conversational search. The conversation lives in AskProvider, not this page, so it survives
// opening a place and switching tabs; each send posts the new message plus recent turns.
export default function Ask() {
  const saves = useSavedPlaces()
  const ask = useAsk()
  const { turns, pending } = ask
  const endRef = useRef(null)
  const turnCount = useRef(turns.length)
  const seen = useRef({ turns: turns.length, pending })

  useLayoutEffect(() => {
    turnCount.current = turns.length
  })

  // Coming back (Back link, back button or tab) returns to where the conversation was left, or
  // to a reply that arrived meanwhile. Runs on mount/unmount (scrollMemory is a stable ref); the
  // save runs before this page's DOM is removed, so the position is not yet clamped by the next page.
  const { scrollMemory } = ask
  useLayoutEffect(() => {
    const saved = scrollMemory.current
    if (saved && saved.turns === turnCount.current) window.scrollTo(0, saved.y)
    else if (turnCount.current) endRef.current?.scrollIntoView({ block: 'end' })
    const counted = turnCount
    return () => {
      // Stop a smooth follow-scroll still running, or it carries on into the next page.
      window.scrollTo({ top: window.scrollY, behavior: 'instant' })
      scrollMemory.current = { y: window.scrollY, turns: counted.current }
    }
  }, [scrollMemory])

  // Follow new messages while the page is open.
  useEffect(() => {
    if (seen.current.turns === turns.length && seen.current.pending === pending) return
    seen.current = { turns: turns.length, pending }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns.length, pending])

  return (
    <Flex direction="column" minH="calc(100dvh - 81px - var(--bottom-nav-space))">
      <Container maxW="lg" flex="1" pt={6} pb={4} px={4}>
        <Stack gap={4}>
          <HStack justify="space-between" align="start" gap={3}>
            <Stack gap={1}>
              <Heading size="2xl">What are you in the mood for?</Heading>
              <Text color="fg.muted">Say it how you'd text a friend. We'll pick the top 3.</Text>
            </Stack>
            {turns.length > 0 && (
              <Button size="sm" variant="ghost" onClick={ask.newSearch} flexShrink={0}>
                <LuRotateCcw /> New search
              </Button>
            )}
          </HStack>
          {!ask.authLoading && (
            <PersonalisedToggle loggedIn={ask.loggedIn} expired={ask.loginExpired} checked={ask.personalised}
              onChange={ask.setPersonalised} />
          )}

          <SaveFeedback feedback={saves.feedback} loadError={saves.loadError} onDismiss={saves.dismiss} onRetry={saves.retry} />
          {turns.length === 0 && (
            <Wrap gap={2}>
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="sm" variant="outline" rounded="full" onClick={() => ask.send(s)}>
                  {s}
                </Button>
              ))}
            </Wrap>
          )}

          {turns.map((turn, i) =>
            turn.from === 'error' ? (
              <AskErrorAlert key={i} kind={turn.kind} onRetry={ask.retry} disabled={pending} />
            ) : (
              <Stack key={i} gap={3}>
                <ChatBubble from={turn.from}>{turn.text}</ChatBubble>
                {turn.filters && (turn.filters.open_now || turn.personalisation?.status === 'on' ||
                  turn.filters.must_tags.length > 0 || turn.filters.want_tags.length > 0) && (
                  <Wrap gap={1}>
                    {turn.filters.open_now && <Badge colorPalette="green" variant="solid" size="sm">Open now</Badge>}
                    {turn.personalisation?.status === 'on' && (
                      <Badge colorPalette="pink" variant="subtle" size="sm"><LuHeart /> Personalised</Badge>
                    )}
                    {turn.filters.must_tags.map((t) => (
                      <Badge key={t} colorPalette="blue" variant="solid" size="sm">
                        {t}
                      </Badge>
                    ))}
                    {turn.filters.want_tags.map((t) => (
                      <Badge key={t} variant="outline" size="sm">
                        {t}
                      </Badge>
                    ))}
                  </Wrap>
                )}
                {turn.personalisation && <PersonalisationNote status={turn.personalisation.status} />}
                {turn.places?.map((p) => (
                  <PlaceCard key={p.id} place={p} reason={p.reason} save={saves.buttonProps(p)} compact />
                ))}
              </Stack>
            ),
          )}

          {pending && (
            <HStack color="fg.muted" gap={2}>
              <Spinner size="sm" />
              <Text>Finding places…</Text>
            </HStack>
          )}
          {/* scroll target; the margin keeps the latest message clear of the sticky composer and tab bar */}
          <Box ref={endRef} scrollMarginBottom="calc(var(--bottom-nav-space) + 88px)" />
        </Stack>
      </Container>

      <Box
        position="sticky"
        bottom="var(--bottom-nav-space)"
        bg="bg.panel"
        borderTopWidth="1px"
        py={3}
      >
        <Container maxW="lg" px={4}>
          <AskComposer value={ask.draft} onChange={ask.setDraft} onSubmit={() => ask.send(ask.draft)} disabled={pending} />
        </Container>
      </Box>
    </Flex>
  )
}
