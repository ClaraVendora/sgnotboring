import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Avatar, Box, Button, Card, Container, Field, Heading, HStack, Input, Link, Stack, Text, Textarea } from '@chakra-ui/react'

const STORAGE_KEY = 'sgnotboring.profile'
const EMPTY_PROFILE = { name: '', neighbourhood: '', bio: '' }

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Object.fromEntries(Object.keys(EMPTY_PROFILE).map((key) => [
      key, typeof saved?.[key] === 'string' ? saved[key] : '',
    ]))
  } catch {
    return { ...EMPTY_PROFILE }
  }
}

export default function Profile() {
  const [profile, setProfile] = useState(loadProfile)
  const [draft, setDraft] = useState(profile)
  const [feedback, setFeedback] = useState(null)
  const name = profile.name || 'Singapore explorer'

  const update = (key, value) => {
    setDraft((previous) => ({ ...previous, [key]: value }))
    setFeedback(null)
  }

  const save = (event) => {
    event.preventDefault()
    const next = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]))
    if (!next.name) {
      setFeedback({ error: true, message: 'Enter a display name to save your profile.' })
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setProfile(next)
      setDraft(next)
      setFeedback({ error: false, message: 'Profile saved.' })
    } catch {
      setFeedback({ error: true, message: 'Couldn’t save your profile. Allow browser storage and try again.' })
    }
  }

  return (
    <Container maxW="3xl" py={10}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading size="3xl">Your profile</Heading>
          <Text color="fg.muted">A little about the explorer behind the next food adventure.</Text>
        </Stack>

        <Card.Root>
          <Card.Body gap={4}>
            <HStack gap={4} align="center">
              <Avatar.Root size="xl" colorPalette="teal">
                <Avatar.Fallback name={name} />
              </Avatar.Root>
              <Stack gap={1} minW={0}>
                <Heading size="xl" overflowWrap="anywhere">{name}</Heading>
                <Text color="fg.muted" overflowWrap="anywhere">{profile.neighbourhood || 'Exploring Singapore'}</Text>
              </Stack>
            </HStack>
            {profile.bio && <Text whiteSpace="pre-wrap" overflowWrap="anywhere">{profile.bio}</Text>}
          </Card.Body>
        </Card.Root>

        <Card.Root>
          <Card.Body gap={4}>
            <Heading size="lg">About you</Heading>
            <Box as="form" onSubmit={save}>
              <Stack gap={4}>
                <Field.Root required>
                  <Field.Label>Display name <Field.RequiredIndicator /></Field.Label>
                  <Input name="name" autoComplete="nickname" maxLength={60} required value={draft.name}
                    onChange={(event) => update('name', event.target.value)} placeholder="What should we call you?" />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Neighbourhood</Field.Label>
                  <Input name="neighbourhood" maxLength={80} value={draft.neighbourhood}
                    onChange={(event) => update('neighbourhood', event.target.value)} placeholder="e.g. Tampines" />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Bio</Field.Label>
                  <Textarea name="bio" maxLength={300} rows={3} value={draft.bio}
                    onChange={(event) => update('bio', event.target.value)} placeholder="Coffee lover, supper hunter, weekend explorer…" />
                  <Field.HelperText>Up to 300 characters.</Field.HelperText>
                </Field.Root>
                <Text fontSize="sm" color="fg.muted">Your profile is saved in this browser on this device.</Text>
                {feedback && <Text role={feedback.error ? 'alert' : 'status'} color={feedback.error ? 'fg.error' : 'teal.fg'}>{feedback.message}</Text>}
                <Button type="submit" colorPalette="teal" alignSelf="flex-start">Save profile</Button>
              </Stack>
            </Box>
          </Card.Body>
        </Card.Root>

        <Link asChild colorPalette="teal" alignSelf="flex-start">
          <RouterLink to="/">Find your next favourite place →</RouterLink>
        </Link>
      </Stack>
    </Container>
  )
}
