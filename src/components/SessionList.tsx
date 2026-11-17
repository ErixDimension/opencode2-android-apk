// SessionList.tsx — §7.2: daftar sesi yang meluncur turun dari .fx-sessionbar
// (transisi geser 300ms), bergulir di dalam kolomnya sendiri.
// §8.5 — tombol di kepala daftar membuka daftar Izin tersimpan (read-only;
// cabut aturan belum terbukti upstream, lihat laporan N4.4.1 butir 3).
import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { sessionStore } from '../lib/sessionStore'
import { useSessionStore } from '../lib/useSessionStore'
import { getPermissionSaved } from '../lib/apiClient'
import { SessionCard } from './SessionCard'
import { PermissionSavedList } from './PermissionSavedList'

interface Props {
  onClose: () => void
  onNew: () => void
}

export function SessionList({ onClose, onNew }: Props) {
  const state = useSessionStore()
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedRules, setSavedRules] = useState<{ id: string; action: string; resource: string; effect?: string }[] | null>(null)

  const loadSavedRules = useCallback(async () => {
    try {
      const rules = await getPermissionSaved()
      setSavedRules(rules)
    } catch {
      setSavedRules([])
    }
  }, [])

  const handleSelect = useCallback((sessionID: string) => {
    void sessionStore.setActive(sessionID)
    onClose()
  }, [onClose])

  const handleDelete = useCallback(async (sessionID: string) => {
    await sessionStore.removeSession(sessionID)
  }, [])

  const handleRename = useCallback(
    async (sessionID: string, title: string) => {
      const res = await sessionStore.renameSession(sessionID, title)
      if (!res.ok) {
        // Error sudah ditangani SessionCard (chip degradasi jujur).
        void res
      }
      return res
    },
    []
  )

  return (
    <div className="fx-session-list" data-open={true} onClick={(e) => e.stopPropagation()}>
      <div className="fx-session-list__head">
        <span className="fx-session-list__title">Daftar <span>sesi</span></span>
        <span className="fx-session-list__count">{state.sessions.length} sesi</span>
        <button
          type="button"
          onClick={() => { void loadSavedRules(); setSavedOpen(true) }}
        >
          Izin tersimpan
        </button>
      </div>
      <div className="fx-session-list__scroll">
        {state.sessions.length === 0 ? (
          <div className="fx-session-list__empty">Belum ada sesi.</div>
        ) : (
          state.sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              activeID={state.active?.id ?? null}
              activeRun={state.activeRun}
              contextLimit={state.modelContextLimit}
              isBusy={state.sessionBusy[s.id] ?? false}
              hasAlert={state.pendingPermission?.some((p) => p.sessionID === s.id) ?? false}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))
        )}
        <button
          type="button"
          className="fx-session-card fx-session-card--add"
          onClick={(e) => { e.stopPropagation(); onNew() }}
        >
          <span className="fx-session-card__node" aria-hidden="true" />
          <div className="fx-session-card__body">
            <span className="fx-session-card__title">Sesi baru</span>
            <span className="fx-session-card__meta">buat sesi baru (lokal)</span>
          </div>
          <Plus size={16} style={{ color: 'var(--fx-cyan)' }} />
        </button>
        {state.sessionsError && (
          <div className="px-16 py-4 text-xs text-rose-400 font-mono space-y-2">
            <div>{state.sessionsError}</div>
            <button
              className="text-emerald-400 hover:underline"
              onClick={() => { void sessionStore.loadSessions() }}
            >
              Muat ulang daftar sesi
            </button>
          </div>
        )}
        {savedOpen && (
          <>
            <div className="fx-sessionlist-backdrop" onClick={() => setSavedOpen(false)} />
            <PermissionSavedList
              open={savedOpen}
              rules={savedRules ?? []}
              onClose={() => setSavedOpen(false)}
            />
          </>
        )}
      </div>
    </div>
  )
}
