import { useEffect, useRef, useState } from 'react'
import { askPlaces } from '../lib/api.js'
import { useSession } from './useSession.js'
import { AskContext } from './useAsk.js'

const TIMEOUT_MS = 20_000
const toggleKey = (userId) => `sgnotboring:personalised:${userId}`

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

function errorKind(error, timedOut) {
  if (timedOut) return 'timeout'
  if (error.status === 429) return 'busy'
  if (error.status === 503) return 'overloaded'
  return 'failed'
}

// The Personalised setting is remembered per user on this device; storage may be unavailable.
function readToggle(userId) {
  try {
    return Boolean(userId) && localStorage.getItem(toggleKey(userId)) === 'on'
  } catch {
    return false
  }
}

// The AI Search conversation lives above the routes, so it survives opening a place, switching
// tabs, and replies that arrive while the page isn't shown. Memory only: a refresh or closed tab
// starts fresh. Logging out (or switching account) remounts it empty; logging in keeps it.
export function AskProvider({ children }) {
  const { session, loading } = useSession()
  const userId = session?.user.id ?? null
  const [owner, setOwner] = useState({ userId, conversation: 0 })
  if (owner.userId !== userId) {
    setOwner({ userId, conversation: owner.userId ? owner.conversation + 1 : owner.conversation })
  }
  return <AskState key={owner.conversation} userId={userId} sessionToken={session?.access_token}
    authLoading={loading}>{children}</AskState>
}

function AskState({ userId, sessionToken, authLoading, children }) {
  const [turns, setTurns] = useState([]) // { from: 'user' | 'assistant' | 'error', text, places?, filters?, ... }
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [toggle, setToggle] = useState(() => ({ userId, on: readToggle(userId) }))
  const personalised = toggle.userId === userId ? toggle.on : readToggle(userId)
  // A personalised request answered as a guest's means the API rejected this login. Shown on the
  // toggle until a later reply is personalised again or the session changes (logging in again).
  const [expiry, setExpiry] = useState({ token: sessionToken, expired: false })
  const loginExpired = expiry.token === sessionToken && expiry.expired
  // New search bumps this, so a reply to the old conversation is dropped when it lands.
  const conversation = useRef(0)
  const active = useRef(null)
  // { y, turns }: where the Ask page was scrolled to, and how many turns it showed, when it was
  // last left. Written and read by the page.
  const view = useRef(null)

  useEffect(() => () => active.current?.abort(), [])

  async function run(request) {
    const id = conversation.current
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, TIMEOUT_MS)
    active.current = controller
    setPending(true)
    try {
      const res = await askPlaces(request.message, request.history, { personalised: request.personalised, signal: controller.signal })
      if (id !== conversation.current) return
      if (request.personalised) setExpiry({ token: sessionToken, expired: res.personalisation?.status === 'logged_out' })
      setTurns((t) => [...t, {
        from: 'assistant', text: res.reply, places: res.places, filters: res.filters, personalisation: res.personalisation,
      }])
    } catch (error) {
      if (id !== conversation.current) return
      setTurns((t) => [...t, { from: 'error', kind: errorKind(error, timedOut), request }])
    } finally {
      clearTimeout(timer)
      if (id === conversation.current) {
        active.current = null
        setPending(false)
      }
    }
  }

  // A new message replaces an unanswered error; the failed message itself stays on screen.
  function send(text) {
    const message = text.trim()
    if (!message || pending) return
    const request = { message, history: toHistory(turns), personalised: Boolean(userId) && personalised }
    setTurns((t) => [...t.filter((turn) => turn.from !== 'error'), { from: 'user', text: message }])
    setDraft('')
    run(request)
  }

  // Resends the failed request exactly (same message, earlier turns and setting).
  function retry() {
    const last = turns.at(-1)
    if (pending || last?.from !== 'error') return
    setTurns((t) => t.slice(0, -1))
    run(last.request)
  }

  function newSearch() {
    conversation.current += 1
    active.current?.abort()
    active.current = null
    view.current = null
    setTurns([])
    setDraft('')
    setPending(false)
  }

  function setPersonalised(on) {
    setToggle({ userId, on })
    try {
      localStorage.setItem(toggleKey(userId), on ? 'on' : 'off')
    } catch {
      // Not remembered on this device; the setting still applies for this session.
    }
  }

  return <AskContext.Provider value={{
    turns, draft, setDraft, pending, send, retry, newSearch,
    authLoading, loggedIn: Boolean(userId), loginExpired, personalised, setPersonalised, scrollMemory: view,
  }}>{children}</AskContext.Provider>
}
