// Hook reaktif pada sessionStore (§4.2/§4.3/§4.5).
// Setiap perubahan store me-render ulang pemakai; komponen tidak boleh
// memanggil sessionStore.getState() telanjang saat render.
import { useEffect, useState } from 'react'
import { sessionStore } from './sessionStore'

export function useSessionStore() {
  const [state, setState] = useState(sessionStore.getState())
  useEffect(() => {
    // subscribe() store saat ini langsung memanggil listener sekali dengan
    // state saat ini; setState dengan referensi sama tidak memicu re-render.
    const unsubscribe = sessionStore.subscribe(setState)
    return unsubscribe
  }, [])
  return state
}
