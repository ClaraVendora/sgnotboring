import { useEffect, useState } from 'react'
import { getPreferences } from '../lib/api.js'

export function usePreferences(session) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const token = session?.access_token
  const key = `${session?.user.id}:${token}:${attempt}`
  useEffect(() => {
    let active = true
    if (!token) return
    getPreferences(token).then(({ preferences }) => {
      if (active) setResult({ key, preferences })
    }).catch(() => {
      if (active) setResult({ key, error: 'Could not load preferences. Please try again.' })
    })
    return () => { active = false }
  }, [token, key])
  return {
    preferences: result?.key === key ? result.preferences : null,
    error: result?.key === key ? result.error : '',
    loading: Boolean(session) && result?.key !== key,
    retry: () => setAttempt((n) => n + 1),
  }
}
