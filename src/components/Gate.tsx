// Gate.tsx — Blok Akses (§4.1 + §0.8). Gerbang sebelum login; perilaku auth persis N2.5.

import { useState, useEffect, type FormEvent } from 'react'
import { Key, Lock, ShieldAlert, Activity } from 'lucide-react'
import { getAuthState, setupPassword, loginPassword, logout, changePassword, type AuthState } from '../lib/apiClient'
import { sessionStore } from '../lib/sessionStore'

const PORTS = [{ label: 'ADAPTER', port: 28572 }, { label: 'ENGINE', port: 28570 }, { label: '9ROUTER', port: 20128 }]

interface Props {
  onApp: () => void
}

export function Gate({ onApp }: Props) {
  const [authState, setAuthState] = useState<AuthState>({ state: 'setup-required' })
  const [view, setView] = useState<'setup' | 'login'>('setup')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [health, setHealth] = useState<Record<number, boolean>>({})

  useEffect(() => {
    void refreshAuth()
    const t = setInterval(refreshHealth, 5000) // RANTAI SISTEM polling /healthz
    void refreshHealth()
    return () => clearInterval(t)
  }, [])

  const refreshAuth = async () => {
    try {
      const st = await getAuthState()
      setAuthState(st)
      if (st.state === 'ready' && view === 'setup') setView('login')
    } catch { setAuthState({ state: 'setup-required' }) }
  }

  const refreshHealth = async () => {
    try {
      const res = await fetch('/healthz', { cache: 'no-store' })
      const json = await res.json()
      const reachable = Boolean(json?.upstream?.reachable)
      const next: Record<number, boolean> = {}
      for (const p of PORTS) next[p.port] = reachable
      setHealth(next)
    } catch {
      setHealth(() => { const n: Record<number, boolean> = {}; for (const p of PORTS) n[p.port] = false; return n })
    }
  }

  const onSetup = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const ok = await setupPassword(password)
      if (ok.ok) { setView('login'); setError('') }
      else setError(ok.error === 'ALREADY_SETUP' ? 'Setup sudah dilakukan. Silakan login.' : 'Gagal setup.')
    } catch { setError('Tidak dapat menghubungi adapter.') }
    finally { setBusy(false) }
  }

  const onLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await loginPassword(password)
      if (res.ok) { onApp(); sessionStore.loadSessions() }
      else if (res.status === 401) setError('Password salah.')
      else if (res.status === 429) setError('Terlalu banyak percobaan. Kunci 60 detik.')
      else if (res.error === 'SETUP_REQUIRED') { setView('setup') }
      else setError('Gagal login.')
    } catch { setError('Tidak dapat menghubungi adapter.') }
    finally { setBusy(false) }
  }

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await changePassword(password, confirm)
      if (res.ok) { await logout(); setView('login'); setPassword(''); setConfirm(''); setError('') }
      else if (res.status === 401) setError('Password saat ini salah.')
      else setError(res.error || 'Gagal ganti password.')
    } catch { setError('Tidak dapat menghubungi adapter.') }
    finally { setBusy(false) }
  }

  const online = PORTS.every((p) => health[p.port] !== false)
  const showUsername = view === 'setup' || authState.state === 'ready'

  return (
    <div className="fx-gate">
      <div className="fx-gate__spine">
        <div className="fx-gate__node" />
      </div>
      <div className="fx-gate__screen">
        {view === 'setup' ? (
          <>
            <div className="fx-gate__chip"><Activity size={12} className="mr-1" /> SETUP</div>
            <div className="fx-gate__card">
              <div className="fx-gate__card__label"><Key size={14} className="mr-2" /> Buat password adapter</div>
              <form onSubmit={onSetup} className="space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-slate-300">USERNAME — OPSIONAL</span>
                  <input className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    value={username} onChange={(e) => setUsername(e.target.value)} placeholder="kosongkan bila tidak diperlukan" />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-slate-300">Password baru (min. 8)</span>
                  <input className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
                </label>
                <div className="fx-gate__meter">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`fx-gate-seg ${i < password.length ? 'filled' : ''}`} />
                  ))}
                </div>
                <div className="fx-gate__sub">{Math.min(8, password.length)} dari 8 karakter minimum</div>
                <label className="block space-y-1 text-sm mt-2">
                  <span className="text-slate-300">ULANGI PASSWORD</span>
                  <input className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
                </label>
                {error && <p className="text-sm text-rose-400">{error}</p>}
                <button type="submit" disabled={busy || password.length < 8 || password !== confirm}
                  className="w-full rounded-md border border-emerald-500 bg-emerald-900/20 px-3 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-900/40 disabled:opacity-50 disabled:border-slate-700 disabled:text-slate-600">
                  {busy ? 'Menyimpan…' : 'AKTIFKAN & MASUK'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <div className="fx-gate__chip"><Lock size={12} className="mr-1" /> LOGIN</div>
            <div className="fx-gate__card">
              <div className="fx-gate__card__label"><ShieldAlert size={14} className="mr-2" /> Masuk</div>
              <form onSubmit={onLogin} className="space-y-3">
                {showUsername && (
                  <label className="block space-y-1 text-sm">
                    <span className="text-slate-300">USERNAME — OPSIONAL</span>
                    <input className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                      value={username} onChange={(e) => setUsername(e.target.value)} placeholder="kosongkan bila tidak diatur" />
                  </label>
                )}
                <label className="block space-y-1 text-sm">
                  <span className="text-slate-300">PASSWORD ADAPTER</span>
                  <input className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                </label>
                <p className="text-xs text-amber-400 font-mono">5× salah berturut — terkunci 60 detik</p>
                {error && <p className="text-sm text-rose-400">{error}</p>}
                <button type="submit" disabled={busy}
                  className="w-full rounded-md border border-emerald-500 bg-emerald-900/20 px-3 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-900/40 disabled:opacity-50">
                  {busy ? 'Memeriksa…' : 'MASUK'}
                </button>
              </form>
            </div>
            <div className="mt-3">
              <button type="button" onClick={onChangePassword} className="fx-copy-btn text-xs">Ganti password</button>
            </div>
          </>
        )}
      </div>
      <div className="fx-gate__footer">
        <div className="fx-chain">
          <span>RANTAI SISTEM</span>
          {PORTS.map((p) => (
            <span key={p.label} className="fx-chain-node" aria-label={`${p.label} ${health[p.port] ? 'online' : 'offline'}`}>
              <span aria-hidden="true">•</span> {p.label} {p.port}
            </span>
          ))}
          <span className="ml-2 text-xs text-slate-600">{online ? 'semua reachable' : 'beberapa tidak terjangkau'}</span>
        </div>
        <div className="mt-3 text-[10px] text-slate-600 font-mono">
          Lupa password → hapus credentials.json di state dir → kembali ke mode setup.
        </div>
      </div>
    </div>
  )
}
