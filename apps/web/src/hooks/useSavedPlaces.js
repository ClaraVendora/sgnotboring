import { createContext, useContext } from 'react'

export const SavedPlacesContext = createContext(null)
export function useSavedPlaces() {
  return useContext(SavedPlacesContext)
}
