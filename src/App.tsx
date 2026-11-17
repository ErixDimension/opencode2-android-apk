// App.tsx — N4: gerbang (Blok Akses) → shell chat. N3 debug UI dihapus.

import { useEffect, useState } from 'react'
import { Gate } from './components/Gate'
import { Shell } from './components/Shell'
import { getAuthState } from './lib/apiClient'
import { sessionStore } from './lib/sessionStore'

type View = 'loading' | 'gate' | 'app'

export default function App() {
  const [view, setView] = useState<View>('loading')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const state = await getAuthState()
        if (cancelled) return
        setView(state.state === 'ready' ? 'app' : 'gate')
      } catch {
        if (!cancelled) setView('gate')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (view === 'app') {
      void sessionStore.loadSessions()
      void sessionStore.loadFirstActive()
    }
  }, [view])

  if (view === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-slate-400 font-mono text-sm">
        Memeriksa status autentikasi…
      </main>
    )
  }

  if (view === 'gate') {
    return <Gate onApp={() => setView('app')} />
  }

  return <Shell />
}
