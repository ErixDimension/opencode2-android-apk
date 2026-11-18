// SessionCard.tsx — §1/§2 N4.4.5: kartu SOLID. Tinggi SELALU
// var(--fx-card-h) (68px), apa pun isinya: idle/aktif/run, konsol rename,
// maupun konfirmasi hapus. Kerangka tetap: node 28px + kolom isi tiga baris
// (judul 20px, model 15px, meta 15px). Baris model SELALU dirender walau
// kosong. Judul/model/meta memakai MarqueeText: teks yang muat diam, teks
// berlebih berjalan kiri-jeda-kanan (bukan ellipsis diam-diam).
// Akar <div role="button">; tombol aksi selalu di baris judul, tidak wrap.
import {
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { Edit2, Trash2, Bot, BarChart3, Undo2 } from 'lucide-react'
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

/*──────────────────────────────────────────────────────────────────────
  MarqueeText — teks berjalan hanya bila lebar teks > lebar wadah.
  --fx-shift = -(lebar teks - lebar wadah), dari pengukuran nyata.
  Durasi sebanding jarak (±30px/detik), minimum 3 detik.
──────────────────────────────────────────────────────────────────────*/
function MarqueeText({
  text,
  className,
  title,
}: {
  text: string
  className?: string
  title?: string
}) {
  const boxRef = useRef<HTMLSpanElement | null>(null)
  const innerRef = useRef<HTMLSpanElement | null>(null)
  const [shift, setShift] = useState(0)
  const [duration, setDuration] = useState(3)

  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return

    const measure = () => {
      const available = box.clientWidth
      const full = inner.scrollWidth
      const overflow = full - available
      if (available > 0 && overflow > 1) {
        setShift(-overflow)
        setDuration(Math.max(3, overflow / 30))
      } else {
        setShift(0)
        setDuration(3)
      }
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [text])

  const style: CSSProperties | undefined =
    shift < 0
      ? ({ '--fx-shift': `${shift}px`, animationDuration: `${duration}s` } as CSSProperties)
      : undefined

  return (
    <span
      ref={boxRef}
      className={`fx-marquee ${shift < 0 ? 'fx-marquee--active' : ''} ${className ?? ''}`}
      title={title}
    >
      <span ref={innerRef} className="fx-marquee__inner" style={style}>
        {text}
      </span>
    </span>
  )
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

  const closeRename = useCallback(() => {
    setRenaming(false)
    setRenameInput(session.title ?? '')
    setRenameError(null)
  }, [session.title])

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
      closeRename()
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
  }, [session.id, session.title, renameInput, onRename, closeRename])

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
  // Baris model SELALU ada; tanpa model cukup teks kosong setinggi baris.
  const modelText = session.model?.id ?? ''

  const metaParts: string[] = []
  const rel = relativeTime(session.updatedAt)
  if (rel) metaParts.push(rel)
  if (tokenTotal != null) metaParts.push(`${formatTokens(tokenTotal)} token`)
  metaParts.push(`konteks ${contextPct != null ? `${contextPct}%` : '—'}`)
  const metaText = metaParts.join(' · ')

  const visibleError = renameError ?? modelError

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
            <MarqueeText
              className="fx-session-card__title"
              text={session.title ?? '(tanpa judul)'}
              title={session.title ?? ''}
            />
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

            <div className="fx-session-card__actions">
              <button
                type="button"
                title="Ganti nama judul sesi (alias lokal)"
                onClick={(e) => {
                  e.stopPropagation()
                  setRenameInput(session.title ?? '')
                  setRenaming(true)
                  setDelConfirm(false)
                  setRenameError(null)
                  setModelError(null)
                }}
              >
                <Edit2 size={13} />
              </button>
              {isActive && (
                <button
                  type="button"
                  title="Buka statistik sesi"
                  onClick={(e) => { e.stopPropagation(); sessionStore.openUsageSheet() }}
                >
                  <BarChart3 size={13} />
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
                  setRenameError(null)
                  setModelError(null)
                }}
              >
                <Trash2 size={13} />
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
                  <Bot size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Zona tukar tetap 30px: model+meta / run / rename / konfirmasi hapus. */}
          <div className="fx-session-card__zone">
            {delConfirm ? (
              <div className="fx-session-card__confirmrow">
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
            ) : renaming ? (
              <div className="fx-session-card__rename">
                <input
                  value={renameInput}
                  maxLength={80}
                  title={session.titleUpstream ? `judul asli: ${session.titleUpstream}` : undefined}
                  onChange={(e) => setRenameInput(e.target.value)}
                  autoFocus={true}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Escape') closeRename()
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
                {session.alias && (
                  <button
                    type="button"
                    className="icon"
                    title={`Kembalikan judul asli: ${session.titleUpstream ?? ''}`}
                    aria-label="Kembalikan judul asli"
                    onClick={(e) => { e.stopPropagation(); void handleRestore() }}
                  >
                    <Undo2 size={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="cancel"
                  title="Batal (Esc)"
                  aria-label="Batal"
                  onClick={(e) => { e.stopPropagation(); closeRename() }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div className="fx-session-card__modelrow">
                  <MarqueeText className="fx-session-card__model" text={modelText} />
                </div>
                <div className="fx-session-card__metarow">
                  {run ? (
                    <div className="fx-session-card__run">
                      Sedang bekerja
                      <span className="fx-session-card__run-dot" aria-hidden={true} />
                      <span className="fx-session-card__run-dot" aria-hidden={true} />
                      <span className="fx-session-card__run-dot" aria-hidden={true} />
                    </div>
                  ) : (
                    <MarqueeText className="fx-session-card__meta" text={metaText} />
                  )}
                </div>
              </>
            )}
          </div>

          {visibleError && (
            <div className="fx-session-card__error" title={visibleError}>
              {visibleError}
            </div>
          )}
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
