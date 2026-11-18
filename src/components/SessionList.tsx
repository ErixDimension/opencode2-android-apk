// SessionList.tsx — §7.2 (N4.4.3): kepala TETAP (judul + hitungan), bar aksi
// TETAP di bawah kepala (+ Sesi baru / Izin tersimpan), dan HANYA area kartu
// yang scroll. Kartu --add di dasar scroll DIHAPUS. Chip error daftar tetap
// di dalam area scroll, di atas kartu pertama.
import { useCallback, useState } from 'react'
import { Plus, ShieldCheck } from 'lucide-react'
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
      </div>

      <div className="fx-session-list__actions">
        <button
          type="button"
          className="fx-session-list__new"
          onClick={(e) => { e.stopPropagation(); onNew() }}
        >
          <Plus size={16} /> Sesi baru
        </button>
        <button
          type="button"
          className="fx-session-list__saved"
          onClick={(e) => { e.stopPropagation(); void loadSavedRules(); setSavedOpen(true) }}
        >
          <ShieldCheck size={16} /> Izin tersimpan
        </button>
      </div>

      <div className="fx-session-list__scroll">
        {state.sessionsError && (
          <div className="fx-session-list__error">
            <div>{state.sessionsError}</div>
            <button
              className="text-emerald-400 hover:underline"
              onClick={() => { void sessionStore.loadSessions() }}
            >
              Muat ulang daftar sesi
            </button>
          </div>
        )}
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
