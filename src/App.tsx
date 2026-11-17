import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { eventStream, type StreamState, type StreamStatus } from './lib/eventStream'
import type { ParsedFrame } from './lib/sseParser'

type AuthView = 'loading' | 'setup' | 'login' | 'app'
type ApiError = { error?: string }

type LogEntry = {
  id: number
  at: string
  type: string
  sessionID: string
}

const STATE_STYLES: Record<StreamState, string> = {
  idle: 'border-slate-600 bg-slate-800 text-slate-300',
  connecting: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  online: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  reconnecting: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  offline: 'border-red-500/40 bg-red-500/10 text-red-300',
  unauthorized: 'border-red-500/40 bg-red-500/10 text-red-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
}

const INPUT_CLASS =
  'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500'

let nextEntryId = 1

async function postJson(path: string, payload: unknown): Promise<{ status: number; data: unknown }> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
    cache: 'no-store',
  })
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  return { status: response.status, data }
}

function errorCode(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const value = (data as ApiError).error
    if (typeof value === 'string') return value
  }
  return ''
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-sm space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">flux-webui</p>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  )
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Password minimal 8 karakter.')
      return
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { status, data } = await postJson('/setup', { password })
      if (status === 200) {
        onDone()
        return
      }
      const code = errorCode(data)
      if (code === 'ALREADY_SETUP') setError('Setup sudah pernah dilakukan. Silakan login.')
      else if (code === 'PASSWORD_TOO_SHORT') setError('Password minimal 8 karakter.')
      else setError('Gagal melakukan setup. Coba lagi.')
    } catch {
      setError('Tidak dapat menghubungi adapter.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Setup password" subtitle="Password ini milik flux-webui, minimal 8 karakter. Password lama proyek 28571 tidak berlaku di sini.">
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-slate-300">Password baru</span>
          <input
            className={INPUT_CLASS}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-slate-300">Konfirmasi password</span>
          <input
            className={INPUT_CLASS}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'Menyimpan…' : 'Simpan password'}
        </button>
      </form>
    </Panel>
  )
}

function LoginForm({ onDone, onSetupRequired }: { onDone: () => void; onSetupRequired: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { status, data } = await postJson('/login', { password })
      if (status === 200) {
        onDone()
        return
      }
      const code = errorCode(data)
      if (status === 401) setError('Password salah.')
      else if (status === 429) setError('Terlalu banyak percobaan. Tunggu sekitar 60 detik.')
      else if (code === 'SETUP_REQUIRED') onSetupRequired()
      else setError('Gagal login. Coba lagi.')
    } catch {
      setError('Tidak dapat menghubungi adapter.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Login" subtitle="Masukkan password flux-webui.">
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-slate-300">Password</span>
          <input
            className={INPUT_CLASS}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </Panel>
  )
}

function DebugPage({ onSignedOut }: { onSignedOut: () => void }) {
  const [status, setStatus] = useState<StreamStatus>(() => eventStream.getStatus())
  const [log, setLog] = useState<LogEntry[]>([])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwMessage, setPwMessage] = useState('')
  const [pwOk, setPwOk] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    eventStream.start()
    const offStatus = eventStream.subscribeStatus(setStatus)
    const offFrames = eventStream.subscribe((frame: ParsedFrame) => {
      if (frame.kind !== 'event') return
      const envelope = frame.envelope
      const data = envelope.data
      const sessionID =
        typeof data?.sessionID === 'string'
          ? data.sessionID
          : typeof envelope.sessionID === 'string'
            ? envelope.sessionID
            : ''
      const entry: LogEntry = {
        id: nextEntryId++,
        at: new Date().toLocaleTimeString(),
        type: typeof envelope.type === 'string' ? envelope.type : '(tanpa type)',
        sessionID,
      }
      setLog((prev) => [entry, ...prev].slice(0, 50))
    })
    return () => {
      offStatus()
      offFrames()
    }
  }, [])

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8) {
      setPwOk(false)
      setPwMessage('Password baru minimal 8 karakter.')
      return
    }
    setBusy(true)
    setPwMessage('')
    try {
      const { status: code, data } = await postJson('/api/auth/change-password', {
        currentPassword,
        newPassword,
      })
      if (code === 200) {
        eventStream.stop()
        onSignedOut()
        return
      }
      setPwOk(false)
      const err = errorCode(data)
      if (code === 401) setPwMessage('Password saat ini salah.')
      else if (err === 'PASSWORD_TOO_SHORT') setPwMessage('Password baru minimal 8 karakter.')
      else if (code === 400) setPwMessage('Password baru tidak valid (8–128 karakter).')
      else setPwMessage('Gagal mengganti password.')
    } catch {
      setPwOk(false)
      setPwMessage('Tidak dapat menghubungi adapter.')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await fetch('/logout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // tetap keluar secara lokal
    }
    eventStream.stop()
    onSignedOut()
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              N3 debug — bukan UI final
            </p>
            <h1 className="text-3xl font-bold tracking-tight">flux-webui</h1>
            <p className="text-sm text-slate-400">
              SSE relay 127.0.0.1:28572 — stream global, scoping dilakukan di frontend.
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500"
          >
            Keluar
          </button>
        </header>

        <section className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATE_STYLES[status.state]}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {status.state}
          </span>
          <span className="text-xs text-slate-500">cookie: flux_session</span>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'data frames', value: status.dataFrames },
            { label: 'heartbeats', value: status.heartbeats },
            { label: 'reconnects', value: status.reconnects },
            { label: 'bad frames', value: status.badFrames },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="text-2xl font-mono font-bold">{item.value}</div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Live log — 50 event terakhir
          </div>
          <ul className="divide-y divide-slate-800/70">
            {log.length === 0 && (
              <li className="px-4 py-6 text-sm text-slate-500">Belum ada event.</li>
            )}
            {log.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 font-mono text-xs">
                <span className="text-slate-500">{entry.at}</span>
                <span className="text-emerald-300">{entry.type}</span>
                {entry.sessionID && <span className="text-slate-400">{entry.sessionID}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Ganti Password</h2>
          <p className="mb-3 text-xs text-slate-500">
            Setelah berhasil, semua sesi (termasuk sesi ini) invalid dan Anda harus login ulang.
          </p>
          <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block space-y-1 text-sm">
              <span className="text-slate-300">Password saat ini</span>
              <input
                className={INPUT_CLASS}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-slate-300">Password baru (min. 8)</span>
              <input
                className={INPUT_CLASS}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? 'Menyimpan…' : 'Ganti'}
            </button>
          </form>
          {pwMessage && (
            <p className={`mt-2 text-sm ${pwOk ? 'text-emerald-400' : 'text-red-400'}`}>{pwMessage}</p>
          )}
        </section>
      </div>
    </main>
  )
}

function App() {
  const [view, setView] = useState<AuthView>('loading')

  useEffect(() => {
    let cancelled = false

    async function resolveAuth() {
      try {
        const stateResponse = await fetch('/api/auth/state', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        })
        const stateJson: unknown = await stateResponse.json().catch(() => null)
        const state =
          stateJson && typeof stateJson === 'object' && 'state' in stateJson
            ? String((stateJson as { state?: unknown }).state)
            : ''

        if (cancelled) return
        if (state === 'setup-required') {
          setView('setup')
          return
        }

        const probe = await fetch('/api/session?limit=1', {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (cancelled) return
        setView(probe.status === 200 ? 'app' : 'login')
      } catch {
        if (!cancelled) setView('login')
      }
    }

    void resolveAuth()
    return () => {
      cancelled = true
    }
  }, [])

  if (view === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-400">
        Memeriksa status autentikasi…
      </main>
    )
  }

  if (view === 'setup') {
    return <SetupForm onDone={() => setView('app')} />
  }

  if (view === 'login') {
    return (
      <LoginForm
        onDone={() => setView('app')}
        onSetupRequired={() => setView('setup')}
      />
    )
  }

  return <DebugPage onSignedOut={() => setView('login')} />
}

export default App
