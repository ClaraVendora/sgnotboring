import { useEffect, useState } from 'react'
import { authConfigured, getSession, onAuthStateChange } from '../lib/api.js'
import { authErrorMessage } from '../lib/auth.js'

export default function useSession() {
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
