import { createContext, useContext } from 'react'

export const AskContext = createContext(null)
export function useAsk() {
  return useContext(AskContext)
}
