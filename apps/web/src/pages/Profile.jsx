import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Card, Container, Field, Heading, HStack, Icon, Input, Link, Skeleton, Spinner, Stack, Tabs, Text } from '@chakra-ui/react'
import { LuHeart, LuLogOut } from 'react-icons/lu'
import { authConfigured, getAccount, signIn, signUp, resendConfirmation } from '../lib/api.js'
import { authErrorMessage, validateCredentials } from '../lib/auth.js'
import { useSession } from '../hooks/useSession.js'
import { usePreferences } from '../hooks/usePreferences.js'
import { useSavedPlaces } from '../hooks/useSavedPlaces.js'
import PlaceCard from '../components/PlaceCard.jsx'
import SaveFeedback from '../components/SaveFeedback.jsx'
import AccountProfileCard from '../components/AccountProfileCard.jsx'
import PreferencesCard from '../components/PreferencesCard.jsx'

export default function Profile() {
  const { session, loading, error: sessionError, retry, logout, logoutPending, logoutFeedback, dismissLogoutFeedback } = useSession()
  const prefs = usePreferences(session)
  const saves = useSavedPlaces()
  const [mode, setMode] = useState('login')
  const [fields, setFields] = useState({ email: '', password: '', displayName: '' })
  const [pending, setPending] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [accountResult, setAccountResult] = useState(null)
  const [accountAttempt, setAccountAttempt] = useState(0)
  const userId = session?.user.id
  const accountKey = `${userId}:${accountAttempt}`
  const account = accountResult?.key === accountKey ? accountResult.user : null
  const accountError = accountResult?.key === accountKey ? accountResult.error : ''
  const displayName = account?.display_name || session?.user.user_metadata?.display_name
  const profileName = typeof displayName === 'string' && displayName.trim()
    ? displayName.trim().slice(0, 60) : 'Singapore explorer'
  const location = useLocation()
  const navigate = useNavigate()
  // Capture callback errors before the SDK removes the URL fragment. Never render
  // arbitrary error descriptions from URLs.
  const [callbackError] = useState(() => {
    const params = new URLSearchParams(location.hash.slice(1))
    const query = new URLSearchParams(location.search)
    const code = params.get('error_code') || query.get('error_code')
    return code || params.has('error') || query.has('error')
      ? authErrorMessage({ code: code || 'otp_expired' }) : ''
  })

  // Only a first-time confirmation (no survey answers yet) opens the survey; anyone who
  // already has preferences lands on Account.
  const firstTime = !prefs.loading && !prefs.preferences
  useEffect(() => {
    if (loading || location.pathname !== '/auth/callback') return
    if (!session || callbackError) navigate('/profile', { replace: true })
    else if (!prefs.loading) navigate(firstTime ? '/onboarding' : '/profile', { replace: true })
  }, [loading, session, callbackError, prefs.loading, firstTime, location.pathname, navigate])

  useEffect(() => {
    let active = true
    if (!userId) return
    getAccount().then(({ user }) => {
      if (active) setAccountResult({ key: accountKey, user, error: '' })
    }).catch((error) => {
      if (active) setAccountResult({ key: accountKey, user: null, error: error.status === 401
        ? 'Your session could not be verified. Please log out and log in again.'
        : 'Could not load your account. Check your connection and retry.' })
    })
    return () => { active = false }
  }, [userId, accountKey])

  const update = (key, value) => {
    setFields((previous) => ({ ...previous, [key]: value }))
    setFeedback(null)
    dismissLogoutFeedback()
  }

  async function submit(event) {
    event.preventDefault()
    if (pending) return
    const validation = validateCredentials(fields, mode === 'signup')
    if (validation) {
      setFeedback({ error: true, message: validation })
      return
    }
    setPending('submit')
    setFeedback(null)
    try {
      const { data, error } = await (mode === 'signup' ? signUp(fields) : signIn(fields))
      if (error) throw error
      setFields((previous) => ({ ...previous, password: '' }))
      if (mode === 'signup' && !data.session) {
        // Supabase intentionally obscures duplicate registrations.
        setFeedback({ error: false, message: 'Check your email for a confirmation link. If you already have an account, log in instead.' })
      }
      if (mode === 'signup' && data.session) navigate('/onboarding')
    } catch (error) {
      setFeedback({ error: true, message: authErrorMessage(error) })
    } finally {
      setPending('')
    }
  }

  async function resend() {
    if (pending) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
      setFeedback({ error: true, message: 'Enter your email address first.' })
      return
    }
    setPending('resend')
    try {
      const { error } = await resendConfirmation(fields.email)
      if (error) throw error
      setFeedback({ error: false, message: 'If your account needs confirmation, a new email has been sent. Check your inbox.' })
    } catch (error) {
      setFeedback({ error: true, message: authErrorMessage(error) })
    } finally {
      setPending('')
    }
  }

  return (
    <Container maxW="2xl" px={{ base: 5, md: 8 }} py={{ base: 7, md: 10 }}>
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading as="h1" size="3xl" letterSpacing="-0.8px">Account</Heading>
          <Text color="fg.muted" fontSize="sm">
            {session ? 'Your favourite places and tastes, all in one place.' : 'Accounts are optional. Browse and search without signing in.'}
          </Text>
        </Stack>
        {loading ? (
          <HStack role="status"><Spinner size="sm" /><Text>Checking your session…</Text></HStack>
        ) : (
          <>
            {sessionError && <Stack gap={2}><Text role="alert" color="fg.error">{sessionError}</Text>
              {authConfigured && <Button variant="outline" onClick={retry}>Retry session</Button>}
            </Stack>}
            {callbackError && !session && <Text role="alert" color="fg.error">{callbackError}</Text>}
            {!session && logoutFeedback && <Text role={logoutFeedback.error ? 'alert' : 'status'}
              fontSize="sm" color={logoutFeedback.error ? 'fg.error' : 'blue.fg'}>{logoutFeedback.message}</Text>}
            {session ? (
              <AccountProfileCard name={profileName} email={account?.email || session.user.email}
                loading={!account && !accountError} error={accountError}
                onRetry={() => setAccountAttempt((n) => n + 1)} />
            ) : (
              <Card.Root rounded="xl">
                <Card.Body gap={5}>
                  <Tabs.Root value={mode} onValueChange={({ value }) => {
                    setMode(value)
                    setFeedback(null)
                    dismissLogoutFeedback()
                    setFields((previous) => ({ ...previous, password: '' }))
                  }} colorPalette="blue">
                    <Tabs.List mb={5}>
                      <Tabs.Trigger value="login" disabled={Boolean(pending)}>Log in</Tabs.Trigger>
                      <Tabs.Trigger value="signup" disabled={Boolean(pending)}>Sign up</Tabs.Trigger>
                    </Tabs.List>
                    {/* Each panel references the same form while retaining keyboard tab semantics. */}
                    <Tabs.Content value={mode}>
                      <Box as="form" onSubmit={submit} noValidate>
                        <Stack gap={4}>
                          {mode === 'signup' && <Field.Root>
                            <Field.Label>Display name (optional)</Field.Label>
                            <Input autoComplete="nickname" maxLength={60} value={fields.displayName} disabled={Boolean(pending)}
                              onChange={(event) => update('displayName', event.target.value)} />
                          </Field.Root>}
                          <Field.Root required>
                            <Field.Label>Email <Field.RequiredIndicator /></Field.Label>
                            <Input type="email" name="email" autoComplete="email" value={fields.email} disabled={Boolean(pending)}
                              onChange={(event) => update('email', event.target.value)} />
                          </Field.Root>
                          <Field.Root required>
                            <Field.Label>Password <Field.RequiredIndicator /></Field.Label>
                            <Input type="password" name="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                              value={fields.password} disabled={Boolean(pending)} onChange={(event) => update('password', event.target.value)} />
                            {mode === 'signup' && <Field.HelperText>At least 8 characters. We will email you a confirmation link.</Field.HelperText>}
                          </Field.Root>
                          <Button type="submit" colorPalette="blue" disabled={!authConfigured || Boolean(pending)} loading={pending === 'submit'}>
                            {mode === 'signup' ? 'Create account' : 'Log in'}
                          </Button>
                          <Button type="button" variant="plain" onClick={resend} disabled={!authConfigured || Boolean(pending)} loading={pending === 'resend'}>
                            Resend confirmation email
                          </Button>
                        </Stack>
                      </Box>
                    </Tabs.Content>
                  </Tabs.Root>
                  {feedback && <Text role={feedback.error ? 'alert' : 'status'} color={feedback.error ? 'fg.error' : 'blue.fg'}>{feedback.message}</Text>}
                </Card.Body>
              </Card.Root>
            )}
            {session && <>
              <PreferencesCard preferences={prefs.preferences} loading={prefs.loading}
                error={prefs.error} onRetry={prefs.retry} />
              <Stack as="section" aria-labelledby="saved-heading" gap={4}>
                <Stack gap={1}>
                  <Heading id="saved-heading" as="h2" size="xl">Saved places{saves.loading || saves.loadError ? '' : ` (${saves.places.length})`}</Heading>
                  <Text fontSize="sm" color="fg.muted">Your shortlist for the next time you head out.</Text>
                </Stack>
                <SaveFeedback feedback={saves.feedback} loadError={saves.loadError} onDismiss={saves.dismiss} onRetry={saves.retry} inline />
                {saves.loading ? <Stack role="status" gap={3}>
                  <Text fontSize="sm" color="fg.muted">Loading saved places…</Text>
                  <Skeleton h="24" rounded="xl" /><Skeleton h="24" rounded="xl" />
                </Stack> : !saves.loadError && (
                  saves.places.length ? <Stack as="ul" aria-label="Saved places" listStyleType="none" m={0} p={0} gap={3}>
                    {saves.places.map((place) => <Box as="li" key={place.id}>
                      <PlaceCard place={place} compact save={saves.buttonProps(place)} />
                    </Box>)}
                  </Stack> : <Card.Root rounded="xl"><Card.Body alignItems="center" textAlign="center" p={6} gap={3}>
                    <Icon as={LuHeart} boxSize={7} color="blue.fg" aria-hidden="true" />
                    <Text fontWeight="semibold">Your next favourite is out there.</Text>
                    <Text fontSize="sm" color="fg.muted">Tap a heart on a place to save it here.</Text>
                    <Button asChild variant="outline" colorPalette="blue" minH="44px">
                      <RouterLink to="/">Explore places</RouterLink>
                    </Button>
                  </Card.Body></Card.Root>
                )}
              </Stack>
              <Stack gap={3} borderTopWidth="1px" pt={5}>
                <Button onClick={logout} loading={logoutPending} loadingText="Logging out…"
                  disabled={Boolean(pending) || logoutPending} variant="outline" minH="44px">
                  <LuLogOut aria-hidden="true" /> Log out
                </Button>
                {logoutFeedback?.error && <Text role="alert" color="fg.error" fontSize="sm">{logoutFeedback.message}</Text>}
              </Stack>
            </>}
          </>
        )}
        <Link asChild colorPalette="blue"><RouterLink to="/">Continue browsing places →</RouterLink></Link>
      </Stack>
    </Container>
  )
}
