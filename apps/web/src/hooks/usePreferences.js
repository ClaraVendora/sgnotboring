import { useEffect, useState } from 'react'
import { getPreferences } from '../lib/api.js'

// Keyed by account, not token: a routine token refresh must not reload preferences
// or put the survey back into its loading state (which would discard unsaved answers).
export function usePreferences(session) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const userId = session?.user.id
  const key = `${userId}:${attempt}`
  useEffect(() => {
    let active = true
    if (!userId) return
    getPreferences().then(({ preferences }) => {
      if (active) setResult({ key, preferences })
    }).catch(() => {
      if (active) setResult({ key, error: 'Could not load preferences. Please try again.' })
    })
    return () => { active = false }
  }, [userId, key])
  return {
    preferences: result?.key === key ? result.preferences : null,
    error: result?.key === key ? result.error : '',
    loading: Boolean(session) && result?.key !== key,
    retry: () => setAttempt((n) => n + 1),
  }
}
