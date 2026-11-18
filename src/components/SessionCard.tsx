// SessionCard.tsx — §7.3/§7.4 (N4.4.3): anatomi kartu kolom — badan baris 1–4
// di atas, baris aksi ikon di bawah. Akar BUKAN <button> (tombol bersarang =
// HTML tidak valid); akar <div role="button"> dengan tombol aksi di dalamnya.
// Semua baris teks ellipsis 1 baris; direktori dipotong di TENGAH.
// Keadaan run: spinner 0,9s + "Sedang bekerja" + titik pulse + sweep.
import { useState, useCallback, type KeyboardEvent } from 'react'
import { Edit2, Trash2, Bot, BarChart3 } from 'lucide-react'
import { sessionStore, type SessionView } from '../lib/sessionStore'

interface Props {
  session: SessionView
  activeID: string | null
  activeRun: boolean
  contextLimit: number | null
  isBusy: boolean
  hasAlert: boolean
  onSelect: (sessionID: string) => void
  onDelete: (sessionID: string) => Promise<void>
  onRename: (sessionID: string, title: string) => Promise<{ ok: boolean; error?: string }>
}

function relativeTime(ts?: number): string {
  if (!ts) return ''
  const d = Date.now() - ts
  if (d < 60000) return 'baru saja'
  if (d < 3600000) return `${Math.floor(d / 60000)} menit lalu`
  if (d < 86400000) return `${Math.floor(d / 3600000)} jam lalu`
  return `${Math.floor(d / 86400000)} hari lalu`
}

function formatTokens(t: number | null | undefined): string {
  if (t == null) return '—'
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}J`
  if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K`
  return String(t)
}

function ctxClass(p: number | null | undefined): 'cyan' | 'warn' | 'critical' | '' {
  if (p == null) return ''
  if (p >= 95) return 'critical'
  if (p >= 80) return 'warn'
  return 'cyan'
}

// Direktori panjang dipotong di TENGAH agar layout tidak didorong:
// /data/data/com.termux/files/home → /data/…/home
function truncatePath(p: string): string {
  if (!p || p.length <= 32) return p
  const parts = p.split('/').filter(Boolean)
  if (parts.length <= 2) return p
  return `/${parts[0]}/…/${parts[parts.length - 1]}`
}

export function SessionCard({
  session,
  activeID,
  activeRun,
  contextLimit,
  isBusy,
  hasAlert,
  onSelect,
  onDelete,
  onRename,
}: Props) {
  const isActive = activeID === session.id
  // §7.3/7.4 — sesi LATAR yang busy (dari event session.*) juga tampil "Sedang bekerja".
  const run = isBusy || (isActive && activeRun)
  const tokens = session.tokens
  const tokenTotal = tokens ? tokens.input + tokens.output + tokens.reasoning : null
  const contextPct =
    contextLimit && tokenTotal != null && contextLimit > 0
      ? Math.min(100, Math.round((tokenTotal / contextLimit) * 100))
      : null

  const [delConfirm, setDelConfirm] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameInput, setRenameInput] = useState(session.title ?? '')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)

  const handleSelect = useCallback(() => {
    setDelConfirm(false)
    setRenaming(false)
    setModelError(null)
    onSelect(session.id)
  }, [session.id, onSelect])

  const handleKeySelect = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect()
    }
  }, [handleSelect])

  const handleDelete = useCallback(async () => {
    setDelConfirm(false)
    try {
      await onDelete(session.id)
    } catch {
      // onDelete mencatat sessionsError di store; tidak diam-diam di sini.
    }
  }, [session.id, onDelete])

  const handleRename = useCallback(async () => {
    const title = renameInput.trim()
    if (!title || title === (session.title ?? '')) {
      setRenaming(false)
      setRenameInput(session.title ?? '')
      setRenameError(null)
      return
    }
    const res = await onRename(session.id, title)
    if (res.ok) {
      setRenaming(false)
      setRenameError(null)
    } else {
      // §7.5 — degradasi jujur: tidak berpura-pura tersimpan.
      setRenameError(res.error ?? 'Ganti judul tidak didukung oleh server.')
    }
  }, [session.id, session.title, renameInput, onRename])

  const statusChip = run ? 'run' : isActive ? 'active' : 'idle'

  return (
    <div
      className="fx-session-card"
      data-state={statusChip}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={handleSelect}
      onKeyDown={handleKeySelect}
    >
      <div className="fx-session-card__row1">
        <span className={`fx-session-card__node ${run ? 'running' : ''}`} aria-hidden="true" />
        {run && <span className="fx-session-card__spin" aria-hidden="true" />}
        <span className="fx-session-card__title">{session.title ?? '(tanpa judul)'}</span>
        {hasAlert && (
          <span className="fx-card-alert" title="Permintaan izin menunggu">
            izin menunggu
          </span>
        )}
        {statusChip !== 'idle' && (
          <span className={`fx-session-card__status ${statusChip}`}>
            {run ? 'PROSES' : 'AKTIF'}
          </span>
        )}
      </div>

      {run ? (
        <div className="fx-session-card__run">
          Sedang bekerja
          <span className="fx-session-card__run-dot" aria-hidden={true} />
          <span className="fx-session-card__run-dot" aria-hidden={true} />
          <span className="fx-session-card__run-dot" aria-hidden={true} />
          {tokenTotal != null ? ` · ${formatTokens(tokenTotal)} token` : ''}
        </div>
      ) : (
        <>
          {session.model?.id && <span className="fx-session-card__model">{session.model.id}</span>}
          <span className="fx-session-card__meta">
            {session.location?.directory ? truncatePath(session.location.directory) : ''}
            {tokenTotal != null ? ` · ${formatTokens(tokenTotal)} token` : ''}
            {session.updatedAt ? ` · ${relativeTime(session.updatedAt)}` : ''}
          </span>
          <div className="fx-session-card__ctxrow">
            <span className="fx-session-card__ctxline">
              <span
                className={`fx-session-card__ctxfill ${ctxClass(contextPct)}`}
                style={{ width: `${contextPct ?? 0}%` }}
              />
            </span>
            <span className={`fx-session-card__ctxlabel ${ctxClass(contextPct)}`}>
              konteks {contextPct != null ? `${contextPct}%` : '—'}
            </span>
          </div>
        </>
      )}

      {renaming && (
        <div className="fx-session-card__rename">
          <input
            className="fx-textarea"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            autoFocus={true}
            onClick={(e) => e.stopPropagation()}
          />
          <button type="button" onClick={(e) => { e.stopPropagation(); void handleRename() }} disabled={!renameInput.trim() || renameInput.trim() === (session.title ?? '')}>
            SIMPAN
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setRenaming(false); setRenameInput(session.title ?? ''); setRenameError(null) }}>
            BATAL
          </button>
        </div>
      )}
      {renameError && <div className="fx-unsupported-chip">{renameError}</div>}
      {modelError && <div className="fx-unsupported-chip">{modelError}</div>}

      {run && <div className="fx-session-card__sweep" aria-hidden="true" />}

      {delConfirm ? (
        <div className="fx-session-card__confirm">
          <span>Hapus sesi ini?</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); setDelConfirm(false) }}>Batal</button>
          <button type="button" className="delete" onClick={(e) => { e.stopPropagation(); void handleDelete() }}>HAPUS</button>
        </div>
      ) : (
        <div className="fx-session-card__actions">
          {!run && (
            <button
              type="button"
              title="Ganti nama judul sesi"
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setModelError(null) }}
            >
              <Edit2 size={16} />
            </button>
          )}
          {!run && isActive && (
            <button
              type="button"
              title="Buka statistik sesi"
              onClick={(e) => { e.stopPropagation(); sessionStore.openUsageSheet() }}
            >
              <BarChart3 size={16} />
            </button>
          )}
          <button
            type="button"
            className="delete"
            title="Hapus sesi"
            onClick={(e) => { e.stopPropagation(); setDelConfirm(true); setRenaming(false); setModelError(null) }}
          >
            <Trash2 size={16} />
          </button>
          {!run && session.model?.id && (
            <button
              type="button"
              title="Model: ganti tidak didukung server"
              onClick={(e) => { e.stopPropagation(); setModelError('Ganti model tidak didukung oleh server (PATCH /api/session/:id → 404)') }}
            >
              <Bot size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
