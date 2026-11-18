// SessionList.tsx — §7.2 + N4.4.4: kepala TETAP (judul + hitungan), bar aksi
// TETAP (+ Sesi baru / ikon perisai Izin tersimpan), kolom search nama sesi,
// dan HANYA area kartu yang scroll. Search memfilter judul EFEKTIF (alias ??
// judul upstream, lihat sessionStore) secara case-insensitive di klien.
import { useCallback, useState } from 'react'
import { Plus, Shield, Search, X } from 'lucide-react'
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
  const [query, setQuery] = useState('')

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

  const handleRestoreAlias = useCallback(async (sessionID: string) => {
    return sessionStore.restoreSessionTitle(sessionID)
  }, [])

  // §1 N4.4.4 — filter judul EFEKTIF (store sudah memetakan alias ?? upstream).
  const trimmed = query.trim()
  const needle = trimmed.toLowerCase()
  const filtered = needle
    ? state.sessions.filter((s) => (s.title ?? '').toLowerCase().includes(needle))
    : state.sessions
  const countLabel = needle
    ? `${filtered.length} dari ${state.sessions.length} sesi`
    : `${state.sessions.length} sesi`

  return (
    <div className="fx-session-list" data-open={true} onClick={(e) => e.stopPropagation()}>
      <div className="fx-session-list__head">
        <span className="fx-session-list__title">Daftar <span>sesi</span></span>
        <span className="fx-session-list__count">{countLabel}</span>
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
          title="Izin tersimpan"
          aria-label="Izin tersimpan"
          onClick={(e) => { e.stopPropagation(); void loadSavedRules(); setSavedOpen(true) }}
        >
          <Shield size={18} />
        </button>
      </div>

      <div className="fx-session-list__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama sesi…"
          aria-label="Cari nama sesi"
          autoComplete="off"
        />
        {query !== '' && (
          <button
            type="button"
            title="Bersihkan pencarian"
            aria-label="Bersihkan pencarian"
            onClick={(e) => { e.stopPropagation(); setQuery('') }}
          >
            <X size={14} />
          </button>
        )}
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
        ) : filtered.length === 0 ? (
          <div className="fx-session-list__empty">
            Tidak ada sesi yang cocok dengan &quot;{trimmed}&quot;.
          </div>
        ) : (
          filtered.map((s) => (
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
              onRestoreAlias={handleRestoreAlias}
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
