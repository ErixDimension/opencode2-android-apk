// SessionCard.tsx — §7.3/§7.4: satu kartu sesi dengan [data-state: active|run|idle],
// animasi run (spinner 0,9s, "Sedang bekerja" + titik pulse 1,2s, sweep tak terduga
// bila tidak ada data langkah nyata), rename (§7.5 — degradasi jujur: PATCH 404
// upstream), delete (§7.6 — interrupt dulu bila berjalan, tidak pernah diam-diam
// gagal), model (§7.7 — degradasi jujur: tidak ada endpoint ganti model upstream).
import { useState, useCallback } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { type SessionView } from '../lib/sessionStore'

interface Props {
  session: SessionView
  activeID: string | null
  activeRun: boolean
  contextLimit: number | null
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

export function SessionCard({
  session,
  activeID,
  activeRun,
  contextLimit,
  hasAlert,
  onSelect,
  onDelete,
  onRename,
}: Props) {
  const isActive = activeID === session.id
  const run = isActive && activeRun
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
    <button
      type="button"
      className="fx-session-card"
      data-state={statusChip}
      aria-pressed={isActive}
      onClick={handleSelect}
    >
      <span className={`fx-session-card__node ${run ? 'running' : ''}`} aria-hidden={true} />
      {run && <span className="fx-session-card__spin" aria-hidden="true" />}
      <div className="fx-session-card__body">
        <div className="fx-session-card__title">{session.title ?? '(tanpa judul)'}</div>
        {hasAlert && (
          <span className="fx-card-alert" title="Permintaan izin menunggu">
            izin menunggu
          </span>
        )}
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
            <span className={`fx-session-card__status ${statusChip}`}>{isActive ? 'AKTIF' : ''}</span>
            {session.model?.id && <span className="fx-session-card__model">{session.model.id}</span>}
            <span className="fx-session-card__meta">
              {session.location?.directory ?? ''}
              {tokenTotal != null ? ` · ${formatTokens(tokenTotal)} token` : ''}
              {contextPct != null && (
                <>
                  · konteks <span className={`ctx ${ctxClass(contextPct)}`}>{contextPct}%</span>
                </>
              )}
              {session.updatedAt ? ` · ${relativeTime(session.updatedAt)}` : ''}
            </span>
            {session.model?.id && (
              <span className="fx-session-card__meta" style={{ fontSize: '11px' }}>
                (ketuk model: ganti tidak didukung server)
              </span>
            )}
          </>
        )}
        {renaming && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              className="fx-textarea"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              autoFocus={true}
            />
            <button type="button" onClick={handleRename} disabled={!renameInput.trim() || renameInput.trim() === (session.title ?? '')}>
              SIMPAN
            </button>
            <button type="button" onClick={() => { setRenaming(false); setRenameInput(session.title ?? ''); setRenameError(null) }}>
              BATAL
            </button>
          </div>
        )}
        {renameError && <div className="fx-unsupported-chip" style={{ marginTop: 6 }}>{renameError}</div>}
        {modelError && <div className="fx-unsupported-chip" style={{ marginTop: 6 }}>{modelError}</div>}
      </div>
      <div className={`fx-session-card__ctxline ${ctxClass(contextPct)}`} style={{ width: `${contextPct ?? 0}%` }} />
      {run && <div className="fx-session-card__sweep" aria-hidden="true" />}
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
        <button
          type="button"
          className="delete"
          title="Hapus sesi"
          onClick={(e) => { e.stopPropagation(); setDelConfirm((c) => !c); setRenaming(false); setModelError(null) }}
        >
          <Trash2 size={16} />
        </button>
        {delConfirm && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
            <span className="fx-session-card__meta" style={{ color: 'var(--fx-red)', whiteSpace: 'nowrap' }}>Hapus sesi ini?</span>
            <button type="button" onClick={() => setDelConfirm(false)}>Batal</button>
            <button type="button" className="delete" onClick={handleDelete}>HAPUS</button>
          </div>
        )}
        {!run && session.model?.id && !delConfirm && !renaming && (
          <button
            type="button"
            title="Model: ganti tidak didukung server"
            onClick={(e) => { e.stopPropagation(); setModelError('Ganti model tidak didukung oleh server (PATCH /api/session/:id → 404)') }}
          >
            model
          </button>
        )}
      </div>
    </button>
  )
}
