import { useEffect, useRef, useState } from 'react'
import { getSavedPlaces, setPlaceSaved } from '../lib/api.js'
import { useSession } from './useSession.js'
import { SavedPlacesContext } from './useSavedPlaces.js'

// Remount immediately on identity/token changes: no previous account's list,
// optimistic state or late response can enter the next account's state.
export function SavedPlacesProvider({ children }) {
  const { session, loading } = useSession()
  return <SavedPlacesState key={`${session?.user.id}:${session?.access_token}`}
    session={session} authLoading={loading}>{children}</SavedPlacesState>
}

function SavedPlacesState({ session, authLoading, children }) {
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(Boolean(session))
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [pending, setPending] = useState(new Set())
  const inFlight = useRef(new Set())
  const alive = useRef(true)
  const [attempt, setAttempt] = useState(0)
  const token = session?.access_token

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    let active = true
    if (!token) return
    getSavedPlaces(token).then(({ places }) => {
      if (active) {
        setPlaces(places)
        setLoadError('')
        setLoading(false)
      }
    }).catch(() => {
      if (active) {
        setLoadError('Could not load saved places. Check your connection and retry.')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [token, attempt])

  async function toggle(place) {
    if (authLoading || inFlight.current.has(place.id)) return
    if (!session) {
      setFeedback({ login: true, message: 'Log in to save places and find them here later.' })
      return
    }
    if (loading || loadError) return
    const previousIndex = places.findIndex(({ id }) => id === place.id)
    const previous = places[previousIndex]
    const nextSaved = !previous
    inFlight.current.add(place.id)
    setPending(new Set(inFlight.current))
    setFeedback(null)
    setPlaces((list) => nextSaved
      ? [{ ...place, saved: true }, ...list]
      : list.filter(({ id }) => id !== place.id))
    try {
      await setPlaceSaved(place.id, nextSaved, token)
      if (alive.current) setFeedback({ message: nextSaved ? `${place.name} saved.` : `${place.name} removed from saved places.` })
    } catch (error) {
      if (!alive.current) return
      setPlaces((list) => {
        if (nextSaved) return list.filter(({ id }) => id !== place.id)
        const restored = [...list]
        restored.splice(Math.min(previousIndex, restored.length), 0, previous)
        return restored
      })
      setFeedback({ error: true, message: error.status === 401
        ? 'Your session expired. Log out and log in again. Your change was not saved.'
        : `Could not ${nextSaved ? 'save' : 'remove'} ${place.name}. Your change was undone. Please try again.` })
    } finally {
      inFlight.current.delete(place.id)
      if (alive.current) setPending(new Set(inFlight.current))
    }
  }

  return <SavedPlacesContext.Provider value={{
    places, loading: loading || authLoading, loadError, feedback,
    dismiss: () => setFeedback(null),
    retry: () => { setLoading(true); setLoadError(''); setAttempt((n) => n + 1) },
    buttonProps: (place) => ({
      saved: places.some(({ id }) => id === place.id),
      pending: pending.has(place.id),
      disabled: authLoading || Boolean(session && (loading || loadError)),
      onToggle: () => toggle(place),
    }),
  }}>{children}</SavedPlacesContext.Provider>
}
