import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Box, Button, Card, Container, Field, Heading, HStack, Input, Link, Spinner, Stack, Tabs, Text } from '@chakra-ui/react'
import { authConfigured, getAccount, getSession, onAuthStateChange, signIn, signOut, signUp, resendConfirmation } from '../lib/api.js'
import { authErrorMessage, validateCredentials } from '../lib/auth.js'

// Move to hooks/useSession.js once a second page needs the session (CLAUDE.md: hooks/).
function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(authConfigured)
  const [error, setError] = useState(authConfigured ? '' : authErrorMessage({ code: 'auth_not_configured' }))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let subscription
    let authEventReceived = false
    if (!authConfigured) return
    try {
      subscription = onAuthStateChange((_event, nextSession) => {
        if (!active) return
        authEventReceived = true
        setSession(nextSession)
        setError('')
        setLoading(false)
      }).data.subscription
      getSession().then(({ data, error: sessionError }) => {
        if (!active) return
        if (sessionError) setError(authErrorMessage(sessionError))
        if (!authEventReceived) setSession(data?.session ?? null)
        setLoading(false)
      }).catch((error) => {
        if (!active) return
        setError(authErrorMessage(error))
        setLoading(false)
      })
    } catch (error) {
      queueMicrotask(() => {
        if (!active) return
        setError(authErrorMessage(error))
        setLoading(false)
      })
    }
    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [attempt])

  return { session, loading, error, retry: () => {
    setLoading(true)
    setError('')
    setAttempt((value) => value + 1)
  } }
}

export default function Profile() {
  const { session, loading, error: sessionError, retry } = useSession()
  const [mode, setMode] = useState('login')
  const [fields, setFields] = useState({ email: '', password: '', displayName: '' })
  const [pending, setPending] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [accountResult, setAccountResult] = useState(null)
  const [accountAttempt, setAccountAttempt] = useState(0)
  const accountKey = `${session?.user.id}:${session?.access_token}:${accountAttempt}`
  const account = accountResult?.key === accountKey ? accountResult.user : null
  const accountError = accountResult?.key === accountKey ? accountResult.error : ''
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

  useEffect(() => {
    if (!loading && location.pathname === '/auth/callback') {
      navigate('/profile', { replace: true })
    }
  }, [loading, location.pathname, navigate])

  useEffect(() => {
    let active = true
    if (!session) return
    getAccount().then(({ user }) => {
      if (active) setAccountResult({ key: accountKey, user, error: '' })
    }).catch((error) => {
      if (active) setAccountResult({ key: accountKey, user: null, error: error.status === 401
        ? 'Your session could not be verified. Please log out and log in again.'
        : 'Could not load your account. Check your connection and retry.' })
    })
    return () => { active = false }
  }, [session, accountKey])

  const update = (key, value) => {
    setFields((previous) => ({ ...previous, [key]: value }))
    setFeedback(null)
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

  async function logout() {
    setPending('logout')
    setFeedback(null)
    try {
      const { error } = await signOut()
      if (error) throw error
      setFields({ email: '', password: '', displayName: '' })
      setFeedback({ error: false, message: 'You have logged out.' })
    } catch (error) {
      setFeedback({ error: true, logout: true, message: authErrorMessage(error) })
    } finally {
      setPending('')
    }
  }

  return (
    <Container maxW="lg" py={{ base: 8, md: 12 }}>
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading size="3xl">Account</Heading>
          <Text color="fg.muted">Accounts are optional. Browse and search without signing in.</Text>
        </Stack>
        {loading ? (
          <HStack role="status"><Spinner size="sm" /><Text>Checking your session…</Text></HStack>
        ) : (
          <>
            {sessionError && <Stack gap={2}><Text role="alert" color="fg.error">{sessionError}</Text>
              {authConfigured && <Button variant="outline" onClick={retry}>Retry session</Button>}
            </Stack>}
            {callbackError && !session && <Text role="alert" color="fg.error">{callbackError}</Text>}
            <Card.Root>
              <Card.Body gap={5}>
                {session ? (
                  <>
                    <HStack gap={4}>
                      <Avatar.Root size="lg" colorPalette="teal">
                        <Avatar.Fallback name={account?.display_name || 'Explorer'} />
                      </Avatar.Root>
                      <Stack gap={1} minW={0}>
                        <Heading size="xl" overflowWrap="anywhere">{account?.display_name || session.user.user_metadata?.display_name || 'Singapore explorer'}</Heading>
                        <Text color="fg.muted" overflowWrap="anywhere">{account?.email || session.user.email}</Text>
                      </Stack>
                    </HStack>
                    {accountError ? (
                      <Stack gap={2}><Text role="alert" color="fg.error">{accountError}</Text>
                        <Button variant="outline" onClick={() => setAccountAttempt((n) => n + 1)}>Retry account</Button>
                      </Stack>
                    ) : <Text role="status" color="fg.muted">{account ? 'You are logged in.' : 'Loading your account…'}</Text>}
                    <Button onClick={logout} loading={pending === 'logout'} disabled={Boolean(pending)} variant="outline">Log out</Button>
                  </>
                ) : (
                  <Tabs.Root value={mode} onValueChange={({ value }) => {
                    setMode(value)
                    setFeedback(null)
                    setFields((previous) => ({ ...previous, password: '' }))
                  }} colorPalette="teal">
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
                          <Button type="submit" colorPalette="teal" disabled={!authConfigured || Boolean(pending)} loading={pending === 'submit'}>
                            {mode === 'signup' ? 'Create account' : 'Log in'}
                          </Button>
                          <Button type="button" variant="plain" onClick={resend} disabled={!authConfigured || Boolean(pending)} loading={pending === 'resend'}>
                            Resend confirmation email
                          </Button>
                        </Stack>
                      </Box>
                    </Tabs.Content>
                  </Tabs.Root>
                )}
                {feedback && (!session || feedback.logout) && <Text role={feedback.error ? 'alert' : 'status'} color={feedback.error ? 'fg.error' : 'teal.fg'}>{feedback.message}</Text>}
              </Card.Body>
            </Card.Root>
          </>
        )}
        <Link asChild colorPalette="teal"><RouterLink to="/">Continue browsing places →</RouterLink></Link>
      </Stack>
    </Container>
  )
}
