import { useSyncExternalStore } from 'react'
import { openStatus } from '../lib/hours.js'

const currentMinute = () => Math.floor(Date.now() / 60000) * 60000
let now = currentMinute()
let timer
const listeners = new Set()
function tick() {
  const next = currentMinute()
  if (next === now) return
  now = next
  listeners.forEach((listener) => listener())
}
function subscribe(listener) {
  listeners.add(listener)
  if (listeners.size === 1) {
    timer = setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    tick()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }
}
const snapshot = () => now
export function useOpenStatus(hours) {
  const time = useSyncExternalStore(subscribe, snapshot)
  return openStatus(hours, new Date(time))
}
