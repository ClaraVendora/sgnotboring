import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Box, Button, Card, Container, Heading, HStack, Link, Spinner, Stack, Text, Wrap } from '@chakra-ui/react'
import { getSurveyOptions, putPreferences } from '../lib/api.js'
import { useSession } from '../hooks/useSession.js'
import { usePreferences } from '../hooks/usePreferences.js'

export default function Onboarding() {
  const { session, loading: authLoading } = useSession()
  const { preferences, loading, error, retry } = usePreferences(session)
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const userId = session?.user.id
  useEffect(() => {
    let active = true
    if (!userId) return
    getSurveyOptions().then(({ questions }) => {
      if (active) { setOptions(questions); setOptionsError('') }
    }).catch(() => { if (active) setOptionsError('Could not load the survey. Please try again.') })
    return () => { active = false }
  }, [userId, attempt])

  return <Container maxW="2xl" py={{ base: 8, md: 12 }}>
    <Stack gap={6}>
      <Stack gap={2}>
        <Text color="blue.fg" fontSize="sm" fontWeight="bold">A little about your taste</Text>
        <Heading size="3xl">Make room for your favourites</Heading>
        <Text color="fg.muted">Four quick questions. Choose what fits, leave anything blank, and edit it anytime in Account.</Text>
      </Stack>
      {authLoading ? <Spinner /> : !session ? <Stack gap={3}>
        <Text>Log in to save your preferences, or keep exploring as a guest.</Text>
        <Button asChild colorPalette="blue"><RouterLink to="/profile">Log in</RouterLink></Button>
      </Stack> : error || optionsError ? <Stack gap={3}>
        <Text role="alert" color="fg.error">{error || optionsError}</Text>
        <Button variant="outline" onClick={() => { retry(); setAttempt((n) => n + 1) }}>Retry survey</Button>
      </Stack> : loading || !options ? <HStack role="status"><Spinner size="sm" /><Text>Loading your preferences…</Text></HStack>
        : <SurveyForm key={preferences?.updated_at || 'new'} questions={options} initialTags={preferences?.tags ?? []} />}
      <Link asChild colorPalette="blue"><RouterLink to="/">Continue browsing places →</RouterLink></Link>
      {(session && (loading || error || optionsError || !options)) && <Link asChild><RouterLink to="/profile">Skip for now</RouterLink></Link>}
    </Stack>
  </Container>
}

function SurveyForm({ questions, initialTags }) {
  const [tags, setTags] = useState(initialTags)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  function toggle(question, tag) {
    setTags((previous) => {
      if (previous.includes(tag)) return previous.filter((value) => value !== tag)
      const retained = question.multiple ? previous
        : previous.filter((value) => !question.options.some((option) => option.tag === value))
      return [...retained, tag]
    })
  }
  async function finish(event) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      await putPreferences(tags)
      navigate('/profile', { replace: true })
    } catch (error) {
      setError(error.status === 401 ? 'Your session expired. Please log in again.'
        : 'Could not save your preferences. Your choices are still here. Please try again.')
      setPending(false)
    }
  }
  return <Box as="form" onSubmit={finish}>
    <Stack gap={4}>
      {questions.map((question, index) => <Card.Root key={question.id}>
        <Card.Body gap={3}>
          <Box as="fieldset" disabled={pending} minW={0}>
            <Box as="legend" fontWeight="semibold" mb={2}>{index + 1}. {question.title}</Box>
            <Text fontSize="sm" color="fg.muted" mb={3}>{question.multiple ? 'Choose any that apply' : 'Choose one'} · optional</Text>
            <Wrap gap={2}>
              {question.options.map(({ tag, label }) => <Button key={tag} type="button" rounded="full" size="sm"
                minH="44px" whiteSpace="normal" height="auto" py={2}
                aria-pressed={tags.includes(tag)} colorPalette="blue"
                variant={tags.includes(tag) ? 'solid' : 'outline'} disabled={pending}
                onClick={() => toggle(question, tag)}>{label}</Button>)}
            </Wrap>
          </Box>
        </Card.Body>
      </Card.Root>)}
      {error && <Text role="alert" color="fg.error">{error}</Text>}
      <HStack justify="space-between" pt={2}>
        <Button variant="ghost" type="button" disabled={pending} onClick={() => navigate('/profile', { replace: true })}>Skip</Button>
        <Button colorPalette="blue" type="submit" loading={pending} disabled={pending}>Finish</Button>
      </HStack>
    </Stack>
  </Box>
}
