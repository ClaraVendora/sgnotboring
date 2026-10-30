import { useEffect, useRef, useState } from 'react'
import { Badge, Box, Button, Container, Flex, Heading, HStack, Spinner, Stack, Text, Wrap } from '@chakra-ui/react'
import { askPlaces } from '../lib/api.js'
import AskComposer from '../components/AskComposer.jsx'
import ChatBubble from '../components/ChatBubble.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import { NAV_HEIGHT } from '../components/BottomNav.jsx'
import SaveFeedback from '../components/SaveFeedback.jsx'
import { useSavedPlaces } from '../hooks/useSavedPlaces.js'

const SUGGESTIONS = [
  'Cheap supper for 6 after midnight',
  'Quiet cafe in Tiong Bahru open now',
  'Atas date night with good cocktails',
  'Halal food near Bugis',
]

// What the API sees of earlier turns: the assistant's reply plus the names it picked, so
// "cheaper than those?" has something to refer to.
function toHistory(turns) {
  return turns
    .filter((t) => t.from !== 'error')
    .slice(-6)
    .map((t) => ({
      role: t.from,
      text: (t.places?.length ? `${t.text} (${t.places.map((p) => p.name).join(', ')})` : t.text).slice(0, 1000),
    }))
}

// Conversational search. The conversation lives in component state, not the URL; each send
// posts the new message plus recent turns.
export default function Ask() {
  const saves = useSavedPlaces()
  const [turns, setTurns] = useState([]) // { from: 'user' | 'assistant' | 'error', text, places?, filters? }
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, loading])

  const send = async (text) => {
    const message = text.trim()
    if (!message || loading) return
    const history = toHistory(turns)
    setTurns((t) => [...t, { from: 'user', text: message }])
    setDraft('')
    setLoading(true)
    try {
      const res = await askPlaces(message, history)
      setTurns((t) => [...t, { from: 'assistant', text: res.reply, places: res.places, filters: res.filters }])
    } catch (e) {
      setTurns((t) => [...t, { from: 'error', text: e.message }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Flex direction="column" minH={`calc(100dvh - 80px - ${NAV_HEIGHT} - env(safe-area-inset-bottom))`}>
      <Container maxW="lg" flex="1" pt={6} pb={4} px={4}>
        <Stack gap={4}>
          <Stack gap={1}>
            <Heading size="2xl">What are you in the mood for?</Heading>
            <Text color="fg.muted">Say it how you'd text a friend. We'll pick the top 3.</Text>
          </Stack>

          <SaveFeedback feedback={saves.feedback} loadError={saves.loadError} onDismiss={saves.dismiss} onRetry={saves.retry} />
          {turns.length === 0 && (
            <Wrap gap={2}>
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="sm" variant="outline" rounded="full" onClick={() => send(s)}>
                  {s}
                </Button>
              ))}
            </Wrap>
          )}

          {turns.map((turn, i) =>
            turn.from === 'error' ? (
              <Text key={i} color="fg.error">
                Couldn't get recommendations: {turn.text}
              </Text>
            ) : (
              <Stack key={i} gap={3}>
                <ChatBubble from={turn.from}>{turn.text}</ChatBubble>
                {turn.filters && (turn.filters.open_now || turn.filters.must_tags.length > 0 || turn.filters.want_tags.length > 0) && (
                  <Wrap gap={1}>
                    {turn.filters.open_now && <Badge colorPalette="green" variant="solid" size="sm">Open now</Badge>}
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
                {turn.places?.map((p) => (
                  <PlaceCard key={p.id} place={p} reason={p.reason} save={saves.buttonProps(p)} compact />
                ))}
              </Stack>
            ),
          )}

          {loading && (
            <HStack color="fg.muted" gap={2}>
              <Spinner size="sm" />
              <Text>Finding places…</Text>
            </HStack>
          )}
          <div ref={endRef} />
        </Stack>
      </Container>

      <Box
        position="sticky"
        bottom={`calc(${NAV_HEIGHT} + env(safe-area-inset-bottom))`}
        bg="bg.panel"
        borderTopWidth="1px"
        py={3}
      >
        <Container maxW="lg" px={4}>
          <AskComposer value={draft} onChange={setDraft} onSubmit={() => send(draft)} disabled={loading} />
        </Container>
      </Box>
    </Flex>
  )
}
