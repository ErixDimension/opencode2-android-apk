// SessionCard.tsx — §2 N4.4.4: bentuk kartu PERSIS frame video panel-sesi-flow:
// blok rounded terpisah, node lingkaran 34px, border+warna latar per status,
// aksi ikon di kanan atas, meta "<waktu> · <token> token · konteks N%",
// hairline konteks di tepi bawah. Akar <div role="button"> (bukan <button>).
// Direktori pindah ke atribut title kartu (tidak lagi di muka kartu).
// Rename = alias lokal (PUT /api/session-alias) — konsol menggantikan baris
// model+meta; bila ada alias tampil "judul asli … · Kembalikan".
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
  onRestoreAlias: (sessionID: string) => Promise<{ ok: boolean; error?: string }>
}

function relativeTime(ts?: number): string {
  if (!ts) return ''
  const d = Date.now() - ts
  if (d < 60000) return 'baru saja'
  if (d < 3600000) return `${Math.floor(d / 60000)} menit lalu`
  if (d < 86400000) return `${Math.floor(d / 3600000)} jam lalu`
  return `${Math.floor(d / 86400000)} hari lalu`
}

// Video memakai satuan Indonesia: 61 rb token / 9 rb token.
function formatTokens(t: number | null | undefined): string {
  if (t == null) return '—'
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (t >= 1_000) return `${Math.round(t / 1_000)} rb`
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
  isBusy,
  hasAlert,
  onSelect,
  onDelete,
  onRename,
  onRestoreAlias,
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
    // Jangan menyeret klik kartu saat fokus ada di input/tombol dalam kartu.
    if (e.target !== e.currentTarget) return
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
      // Gagal jaringan/server: chip error jujur, konsol tetap terbuka.
      setRenameError(res.error ?? 'Gagal menyimpan alias.')
    }
  }, [session.id, session.title, renameInput, onRename])

  const handleRestore = useCallback(async () => {
    const res = await onRestoreAlias(session.id)
    if (res.ok) {
      setRenaming(false)
      setRenameInput(session.titleUpstream ?? '')
      setRenameError(null)
    } else {
      setRenameError(res.error ?? 'Gagal mengembalikan judul.')
    }
  }, [session.id, session.titleUpstream, onRestoreAlias])

  const statusChip = run ? 'run' : isActive ? 'active' : 'idle'
  const directory = session.location?.directory ?? ''

  const metaParts: string[] = []
  const rel = relativeTime(session.updatedAt)
  if (rel) metaParts.push(rel)
  if (tokenTotal != null) metaParts.push(`${formatTokens(tokenTotal)} token`)
  metaParts.push(`konteks ${contextPct != null ? `${contextPct}%` : '—'}`)

  return (
    <div
      className="fx-session-card"
      data-state={statusChip}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      title={directory}
      onClick={handleSelect}
      onKeyDown={handleKeySelect}
    >
      <div className="fx-session-card__top">
        <span className={`fx-session-card__node ${statusChip}`} aria-hidden="true">
          <span className="fx-session-card__node-dot" />
        </span>

        <div className="fx-session-card__content">
          <div className="fx-session-card__row1">
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

            <div className="fx-session-card__actionslot">
              {delConfirm ? (
                <div className="fx-session-card__confirm">
                  <span>Hapus sesi ini?</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDelConfirm(false) }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="delete"
                    onClick={(e) => { e.stopPropagation(); void handleDelete() }}
                  >
                    HAPUS
                  </button>
                </div>
              ) : (
                <div className="fx-session-card__actions">
                  <button
                    type="button"
                    title="Ganti nama judul sesi (alias lokal)"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenameInput(session.title ?? '')
                      setRenaming(true)
                      setRenameError(null)
                      setModelError(null)
                    }}
                  >
                    <Edit2 size={15} />
                  </button>
                  {isActive && (
                    <button
                      type="button"
                      title="Buka statistik sesi"
                      onClick={(e) => { e.stopPropagation(); sessionStore.openUsageSheet() }}
                    >
                      <BarChart3 size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="delete"
                    title="Hapus sesi"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDelConfirm(true)
                      setRenaming(false)
                      setModelError(null)
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                  {session.model?.id && (
                    <button
                      type="button"
                      title="Model: ganti tidak didukung server"
                      onClick={(e) => {
                        e.stopPropagation()
                        setModelError('Ganti model tidak didukung oleh server (PATCH /api/session/:id → 404)')
                      }}
                    >
                      <Bot size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {renaming ? (
            <div className="fx-session-card__rename">
              <div className="fx-session-card__rename-row">
                <input
                  value={renameInput}
                  maxLength={80}
                  onChange={(e) => setRenameInput(e.target.value)}
                  autoFocus={true}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Escape') {
                      setRenaming(false)
                      setRenameInput(session.title ?? '')
                      setRenameError(null)
                    }
                    if (e.key === 'Enter') void handleRename()
                  }}
                />
                <button
                  type="button"
                  className="save"
                  disabled={!renameInput.trim() || renameInput.trim() === (session.title ?? '')}
                  onClick={(e) => { e.stopPropagation(); void handleRename() }}
                >
                  SIMPAN
                </button>
                <button
                  type="button"
                  className="cancel"
                  title="Batal (Esc)"
                  aria-label="Batal"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenaming(false)
                    setRenameInput(session.title ?? '')
                    setRenameError(null)
                  }}
                >
                  ✕
                </button>
              </div>
              {session.alias && session.titleUpstream && (
                <div className="fx-session-card__alias-hint">
                  <span>judul asli: {session.titleUpstream}</span>
                  <span>·</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); void handleRestore() }}>
                    Kembalikan
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {session.model?.id && <span className="fx-session-card__model">{session.model.id}</span>}
              {run ? (
                <div className="fx-session-card__run">
                  Sedang bekerja
                  <span className="fx-session-card__run-dot" aria-hidden={true} />
                  <span className="fx-session-card__run-dot" aria-hidden={true} />
                  <span className="fx-session-card__run-dot" aria-hidden={true} />
                </div>
              ) : (
                <span className="fx-session-card__meta">{metaParts.join(' · ')}</span>
              )}
            </>
          )}

          {renameError && <div className="fx-unsupported-chip">{renameError}</div>}
          {modelError && <div className="fx-unsupported-chip">{modelError}</div>}
        </div>
      </div>

      {run ? (
        <div className="fx-session-card__sweep" aria-hidden="true" />
      ) : (
        <span className="fx-session-card__ctxline" aria-hidden="true">
          <span
            className={`fx-session-card__ctxfill ${ctxClass(contextPct)}`}
            style={{ width: `${contextPct ?? 0}%` }}
          />
        </span>
      )}
    </div>
  )
}
