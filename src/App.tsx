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
        const auth = await getAuthState()
        if (cancelled) return
        if (auth.state === 'setup-required') {
          setView('gate')
          return
        }
        // 'ready' = kredensial adaptor tersimpan, BUKAN berarti sudah ada sesi
        // cookie flux_session yang valid. Uji endpoint butuh autentikasi;
        // 401 = belum login → arahkan ke gerbang untuk membuat cookie.
        const res = await fetch('/api/session?limit=1', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        })
        if (cancelled) return
        setView(res.ok ? 'app' : 'gate')
      } catch {
        if (!cancelled) setView('gate')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (view === 'app') {
      void (async () => {
        // loadSessions dulu, baru loadFirstActive — sesi pertama dipilih
        // hanya setelah daftar benar-benar tiba dari adaptor.
        await sessionStore.bootstrap()
      })()
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
