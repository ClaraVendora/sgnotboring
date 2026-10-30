import { useEffect, useRef, useState } from 'react'
import { authConfigured, getSession, onAuthStateChange, signOut } from '../lib/api.js'
import { authErrorMessage } from '../lib/auth.js'
import { SessionContext } from './useSession.js'

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(authConfigured)
  const [error, setError] = useState(authConfigured ? '' : authErrorMessage({ code: 'auth_not_configured' }))
  const [attempt, setAttempt] = useState(0)
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutFeedback, setLogoutFeedback] = useState(null)
  const signingOut = useRef(false)

  useEffect(() => {
    let active = true
    let subscription
    let authEventReceived = false
    if (!authConfigured) return
    try {
      subscription = onAuthStateChange((event, nextSession) => {
        if (!active) return
        authEventReceived = true
        setSession(nextSession)
        setError('')
        setLoading(false)
        if (event === 'SIGNED_IN') setLogoutFeedback(null)
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

  // Account content is remounted when Auth emits SIGNED_OUT. Keep the operation
  // result above that boundary, including SDK errors that still clear local state.
  async function logout() {
    if (signingOut.current) return
    signingOut.current = true
    setLogoutPending(true)
    setLogoutFeedback(null)
    try {
      const { error } = await signOut()
      if (error) throw error
      setLogoutFeedback({ error: false, message: 'You have logged out.' })
    } catch (error) {
      const current = await getSession().catch(() => null)
      setLogoutFeedback({ error: true, message: current?.data?.session === null
        ? 'You are logged out on this device, but the server could not confirm logout. Log in again to retry.'
        : authErrorMessage(error) })
    } finally {
      signingOut.current = false
      setLogoutPending(false)
    }
  }

  return <SessionContext.Provider value={{ session, loading, error, logout, logoutPending, logoutFeedback,
    dismissLogoutFeedback: () => setLogoutFeedback(null), retry: () => {
    setLoading(true)
    setError('')
    setAttempt((value) => value + 1)
  } }}>{children}</SessionContext.Provider>
}
