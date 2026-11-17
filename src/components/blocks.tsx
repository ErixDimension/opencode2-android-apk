// blocks.tsx — renderer per data-kind (§3) untuk blok FluxBlock.
// Semua blok menempel pada tulang (.fx-spine); tidak ada kartu melayang bebas (§4.3).

import * as React from 'react'
import { useState } from 'react'
import { Copy, RotateCcw, FileCode, ShieldAlert } from 'lucide-react'
import { type FluxBlock } from '../lib/blockMapper'

/*──────────────────────────────────────────────────────────────────────
  Highlighter ringan untuk slab kode (§3.4, token --tok-*)
  ─────────────────────────────────────────────────────────────────────*/
function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c)) }

function highlight(code: string): string {
  return esc(code)
    .replace(/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|throw|async|await|class|extends|import|export|from|default|new|this|typeof|instanceof|true|false|null|undefined)\b/g, '<span class="fx-tok kw">$1</span>')
    .replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, '<span class="fx-tok type">$1</span>')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '<span class="fx-tok str">$&</span>')
    .replace(/\/\/[^\n\r]*/g, '<span class="fx-tok comment">$&</span>')
    .replace(/([({,;:=+\-*/%&|<>!~])/g, '<span class="fx-tok punct">$1</span>')
}

/*──────────────────────────────────────────────────────────────────────
  Simpul mata (§0.5 — eye-knot menang untuk code) — SVG inline di --fx-spine-x
  ─────────────────────────────────────────────────────────────────────*/
export function EyeKnot({ live = false }: { live?: boolean }) {
  return (
    <svg className={`fx-eye-knot ${live ? 'is-live' : ''}`} width="28" height="14" viewBox="0 0 28 14" style={{ '--fx-knot-scale': '1', position: 'absolute', left: 'calc(var(--fx-spine-x) - 14px)', top: '6px' } as unknown as React.CSSProperties} aria-hidden="true">
      <ellipse cx="14" cy="7" rx="12" ry="6" fill="none" stroke="var(--fx-green)" strokeWidth="2" />
      <circle cx="14" cy="7" r="2.5" fill="var(--fx-green)" />
    </svg>
  )
}

/*──────────────────────────────────────────────────────────────────────
  user (§3.1)
  ─────────────────────────────────────────────────────────────────────*/
export function UserBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'user'; text: string; edited: boolean }
  return (
    <section className="fx-block" data-kind="user" data-status={block.status}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11.5px] text-cyan-400">YOU</span>
        {p.edited && <span className="fx-edited-badge">diedit</span>}
      </div>
      <div className="mt-1 font-mono text-sm text-slate-300 whitespace-pre-wrap">{esc(p.text)}</div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  stream (§3.2) — satu blok, delta ditumpuk, kursor berkedip saat live
  ─────────────────────────────────────────────────────────────────────*/
export function StreamBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'stream'; text: string; live: boolean }
  return (
    <section className="fx-block" data-kind="stream" data-status={block.status}>
      <div className="font-mono text-sm text-slate-200 whitespace-pre-wrap break-words">
        {esc(p.text)}
        {p.live && <span className="fx-stream-cursor" aria-hidden="true" />}
      </div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  thought (§3.3) — simpul ∝ log durasi, collapse via grid 0fr→1fr
  ─────────────────────────────────────────────────────────────────────*/
export function ThoughtBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'thought'; text: string; durSec: number; live: boolean }
  const [open, setOpen] = useState(false)
  const scale = Math.min(0.7 + Math.log10(p.durSec + 1), 1.3) // §1.6 --fx-knot-scale
  const style = { '--fx-knot-scale': String(scale) } as unknown as React.CSSProperties
  const kb = p.durSec > 30 ? 'double' : 'single'
  return (
    <section className={`fx-block fx-thought ${p.live ? 'is-live' : ''} ${open ? 'is-open' : ''}`} data-kind="thought" data-status={block.status} style={style}>
      <div className="fx-thought-body">
        <button className="fx-knot" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <svg className="fx-knot-svg" width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r={kb === 'double' ? 10 : 9} />
            {kb === 'double' && <circle cx="10" cy="10" r="4" />}
          </svg>
          <span>Thought · {p.durSec}s</span>
        </button>
        {open && (
          <div className="mt-2 font-mono text-xs text-slate-300 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlight(p.text) }} />
        )}
      </div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  code (§3.4) — eye-knot, slab internal 46dvh, nomor baris, baris aktif
  ─────────────────────────────────────────────────────────────────────*/
export function CodeBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'code'; file: string; lines: { n: number; text: string }[]; activeLine?: number; live: boolean }
  return (
    <section className="fx-block" data-kind="code" data-status={block.status}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[11.5px] text-emerald-400"><FileCode size={14} /> {esc(p.file)}</span>
        {p.live && <span className="text-xs text-cyan-400 animate-pulse">membaca…</span>}
      </div>
      <div className="relative font-mono text-xs text-slate-300" style={{ maxHeight: '46dvh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {p.lines.map((line) => {
          const active = line.n === p.activeLine
          return (
            <div key={line.n} className={`flex gap-2 ${active ? 'fx-line-active' : ''}`}>
              <span className="w-4 text-right pr-2 text-slate-600 select-none">{line.n}</span>
              <span className="break-all" dangerouslySetInnerHTML={{ __html: highlight(line.text) }} />
              {active && <span className="absolute left-[-26px] top-0 w-[26px] h-4 bg-cyan-500/60" aria-hidden="true" />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  command (§3.5) — baris antrean .fx-cmd-row
  ─────────────────────────────────────────────────────────────────────*/
export function CommandBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'command'; items: { cmd: string; status: 'queued' | 'live' | 'done' | 'error'; durationMs?: number }[] }
  return (
    <section className="fx-block" data-kind="command" data-status={block.status}>
      {p.items.map((item, i) => {
        let stateNode
        let cls = ''
        if (item.status === 'live') { cls = 'text-cyan-400'; stateNode = <span className="flex items-center gap-1"><span className="fx-spin" aria-hidden="true" /> berjalan</span> }
        else if (item.status === 'done') { cls = 'text-emerald-400'; stateNode = <span>✓ {item.durationMs != null ? item.durationMs + 's' : ''}</span> }
        else if (item.status === 'error') { cls = 'text-rose-400'; stateNode = <span>✗ error</span> }
        else { cls = 'text-slate-500'; stateNode = <span>⋯</span> }
        return (
          <div key={i} className="fx-cmd-row" data-status={item.status}>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-xs text-slate-200 truncate flex-1">{esc(item.cmd)}</span>
            <span className={`fx-cmd-state ${cls}`}>{stateNode}</span>
          </div>
        )
      })}
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  log (§3.6) — slab 40dvh, ±120 baris render, pill jump to latest
  ─────────────────────────────────────────────────────────────────────*/
export function LogBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'log'; title: string; lines: { cls: 'info' | 'warn' | 'error' | 'success' | 'cmd'; text: string }[]; total: number }
  const [scrolled, setScrolled] = useState(false)
  const lines = p.total > 120 ? p.lines.slice(-120) : p.lines // §3.6 — ±120 baris render
  const CLS_COLOR: Record<string, string> = { info: 'text-slate-400', warn: 'text-amber-400', error: 'text-rose-400', success: 'text-emerald-400', cmd: 'text-cyan-300' }
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setScrolled(el.scrollHeight - el.scrollTop - el.clientHeight > 40)
  }
  return (
    <section className="fx-block" data-kind="log" data-status={block.status}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11.5px] text-violet-400">Log — {esc(p.title)}</span>
        <span className="font-mono text-xs text-slate-500">{p.total} baris</span>
        <button className="fx-copy-btn" title="Salin log"><Copy size={14} /> salin</button>
      </div>
      {p.total > 120 && !scrolled && <div className="fx-jump-latest mb-2"><RotateCcw size={14} /> Jump to latest</div>}
      <div
        className="font-mono text-xs whitespace-pre-wrap break-words"
        style={{ maxHeight: '40dvh', overflowY: 'auto', overscrollBehavior: 'contain' }}
        onScroll={onScroll}
      >
        {lines.map((line, i) => (
          <div key={i} className={`fx-log-line ${CLS_COLOR[line.cls]}`}>{esc(line.text)}</div>
        ))}
        {p.total > 120 && <div className="text-slate-600 mt-1">… ({p.total - 120} baris lebih lama; salin mengambil seluruh data)</div>}
      </div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  error (§3.7) — node kotak merah, retakan tulang, tidak pernah telanjang
  ─────────────────────────────────────────────────────────────────────*/
export function ErrorBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'error'; location: string; lines: string[] }
  return (
    <section className="fx-block" data-kind="error" data-status="done">
      <svg className="w-3 h-3 mt-[-2px] ml-[-4px]" viewBox="0 0 24 24" fill="none" stroke="var(--fx-red)" strokeWidth="2">
        <polyline points="12 4 16 8 12 12" /><polyline points="12 20 8 16 12 12" />
      </svg>
      <div className="border border-rose-500/30 bg-rose-900/20 rounded-lg p-3 font-mono text-xs text-rose-300 whitespace-pre-wrap break-words">
        <div className="mb-1 text-rose-400 font-bold">{esc(p.location)}</div>
        {p.lines.map((line, i) => <div key={i}>{esc(line)}</div>)}
      </div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  limit (§3.8 / §0.10 — hanya bila data nyata memicu; status jujur)
  ─────────────────────────────────────────────────────────────────────*/
export function LimitBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'limit'; model: string; seconds?: number }
  const sec = p.seconds ?? 30
  return (
    <section className="fx-block" data-kind="limit" data-status={block.status}>
      <div className="fx-limit">
        <div className="flex items-center gap-2 mb-2"><ShieldAlert size={16} className="text-amber-400" />
          <span className="font-bold text-amber-300">⚠ MODEL KENA LIMIT</span>
        </div>
        <p className="text-sm text-slate-300 mb-3">429 · kuota token <span className="text-amber-400 font-mono">{esc(p.model)}</span> tercapai. Stream berhenti di tengah kalimat — bukan error kamu.</p>
        <div className="flex items-center gap-3">
          <svg className="fx-limit-ring"><circle cx="22" cy="22" r="20" /></svg>
          <span className="font-mono text-xs text-amber-300">{Math.max(0, sec)} detik</span>
        </div>
      </div>
      <div className="fx-fallback-line">✓ Beralih: model fallback via 9Router · konteks dipadatkan · stream dilanjutkan di blok yang sama</div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  diff (§3.9) — helix header, baris +/−
  ─────────────────────────────────────────────────────────────────────*/
export function DiffBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'diff'; lines: { op: '+' | '-' | ' '; text: string }[]; removed: number; added: number }
  return (
    <section className="fx-block" data-kind="diff" data-status="done">
      <div className="fx-helix">
        <svg width="180" height="24"><path d="M0 12 Q 40 0 80 12 T 160 12" fill="none" stroke="var(--fx-green)" strokeWidth="2" /></svg>
        <svg width="180" height="24"><path d="M0 12 Q 40 24 80 12 T 160 12" fill="none" stroke="var(--fx-red)" strokeWidth="2" /></svg>
        <span className="font-mono text-xs text-slate-500">−{p.removed} / +{p.added}</span>
      </div>
      <div className="font-mono text-xs space-y-[1px] overflow-hidden max-h-[40dvh] overflow-y-auto">
        {p.lines.map((line, i) => {
          const cls = line.op === '+' ? 'text-emerald-400' : line.op === '-' ? 'text-rose-400' : 'text-slate-500'
          return <div key={i} className={`pl-2 ${cls} whitespace-pre border-l-2 border-transparent`}>{line.op === ' ' ? ' ' : line.op}{esc(line.text)}</div>
        })}
      </div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  summary (§3.10) — struktur tetap, segel, salin dari data (bukan DOM)
  ─────────────────────────────────────────────────────────────────────*/
export function SummaryBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'summary'; sections: { title: string; items: string[] }[]; seals: { label: string; ok: boolean }[]; deleted?: { path: string; count: number; backup: string } }
  const [copied, setCopied] = useState(false)
  const text = buildSummaryText(p)
  const handleCopy = async () => {
    let ok = false
    try { await navigator.clipboard.writeText(text); ok = true } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { ok = false }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (!ok) alert('Gagal menyalin — tahan teks untuk menyalin manual') // tidak boleh gagal diam-diam
  }
  return (
    <section className="fx-block" data-kind="summary" data-status="done">
      <div className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-3">RINGKASAN RINCIAN</div>
      {p.sections.map((s) => (
        <div key={s.title} className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-cyan-300">{s.title}</span>
            <button className="fx-copy-btn" onClick={() => { void navigator.clipboard.writeText(s.items.join(' · ')); setCopied(true); setTimeout(() => setCopied(false), 2000) }}><Copy size={14} /></button>
          </div>
          <div className="ml-2 font-mono text-sm text-slate-200 whitespace-pre-wrap">{s.items.map((it, i) => <>{i > 0 ? ' · ' : null}{esc(it)}</>)}</div>
        </div>
      ))}
      {p.deleted && (
        <div className="mb-2">
          <span className="font-bold text-rose-400">Dihapus</span>
          <div className="ml-2 font-mono text-sm text-rose-300">{esc(p.deleted.path)} · {p.deleted.count} file · backup {esc(p.deleted.backup)}</div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {p.seals.map((seal) => (
          <span key={seal.label} className={`fx-seal ${seal.ok ? 'pass' : 'fail'}`}>
            <svg className="fx-seal__ring"><circle cx="13" cy="13" r="11" /></svg>
            <span className="text-xs font-mono">{seal.ok ? '✓ PASS' : '✗ FAIL'} — {esc(seal.label)}</span>
          </span>
        ))}
      </div>
      <div className="mt-3">
        <button className={`fx-copy-btn ${copied ? 'is-copied' : ''}`} onClick={handleCopy}>
          <Copy size={14} /> {copied ? '✓ Tersalin' : 'Salin Ringkasan Ini'}
        </button>
      </div>
    </section>
  )
}
function buildSummaryText(p: { sections: { title: string; items: string[] }[]; seals: { label: string; ok: boolean }[]; deleted?: { path: string; count: number; backup: string } }): string {
  const parts: string[] = ['RINGKASAN RINCIAN']
  for (const s of p.sections) parts.push(`${s.title}: ${s.items.join(' · ')}`)
  for (const seal of p.seals) parts.push(`VERIFIKASI ${seal.label}: ${seal.ok ? 'PASS' : 'FAIL'}`)
  if (p.deleted) parts.push(`Dihapus ${p.deleted.path} · ${p.deleted.count} file · backup ${p.deleted.backup}`)
  return parts.join('\n')
}

/*──────────────────────────────────────────────────────────────────────
  permission (§0.3) — node amber denyut, IZINKAN / TOLAK
  ─────────────────────────────────────────────────────────────────────*/
export function PermissionBlock({ block, onReply }: { block: FluxBlock; onReply: (reply: 'accept' | 'reject') => void }) {
  const p = block.payload as { kind: 'permission'; requestID: string; tool: string; input: string; status: 'pending' | 'allowed' | 'rejected' | 'expired' }
  const cls = p.status === 'allowed' ? 'allowed' : p.status === 'rejected' ? 'rejected' : ''
  return (
    <section className={`fx-permission ${p.status === 'pending' ? 'is-live' : ''}`} data-kind="permission" data-status={p.status}>
      {p.status === 'pending' ? (
        <>
          <div className="fx-permission__header">
            <span className="fx-permission__tag">IZIN DIMINTA</span>
            <span className="fx-permission__tool">{esc(p.tool)}</span>
          </div>
          <div className="fx-permission__summary">{esc(p.input)}</div>
          <div className="fx-permission-actions">
            <button className="allow" onClick={() => onReply('accept')}>IZINKAN</button>
            <button className="reject" onClick={() => onReply('reject')}>TOLAK</button>
          </div>
        </>
      ) : (
        <div className={`fx-permission__result ${cls}`}>
          {p.status === 'allowed' ? '✓ Diizinkan — ' : '✗ Ditolak — '}{esc(p.tool)}
        </div>
      )}
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  delete — node merah, tanpa anatomi lanjut (§3.11)
  ─────────────────────────────────────────────────────────────────────*/
export function DeleteBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'delete'; path: string }
  return (
    <section className="fx-block fx-attempt-collapsed" data-kind="delete" data-status="done">
      <div className="flex items-center gap-2 text-rose-400 font-mono text-sm">✗ {esc(p.path)}</div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  research — slab gaya log (§0.4b)
  ─────────────────────────────────────────────────────────────────────*/
export function ResearchBlock({ block }: { block: FluxBlock }) {
  const p = block.payload as { kind: 'research'; title: string; text: string }
  return (
    <section className="fx-block" data-kind="research" data-status="done">
      <div className="font-mono text-[11.5px] text-violet-400 mb-1">{esc(p.title)}</div>
      <div className="font-mono text-xs text-slate-300 whitespace-pre-wrap break-words">{esc(p.text)}</div>
    </section>
  )
}

/*──────────────────────────────────────────────────────────────────────
  Dispatcher per kind
  ─────────────────────────────────────────────────────────────────────*/
export function RenderBlock({ block, onPermissionReply }: { block: FluxBlock; onPermissionReply: (reply: 'accept' | 'reject') => void }) {
  switch (block.kind) {
    case 'user': return <UserBlock block={block} />
    case 'stream': return <StreamBlock block={block} />
    case 'thought': return <ThoughtBlock block={block} />
    case 'code': return <CodeBlock block={block} />
    case 'command': return <CommandBlock block={block} />
    case 'log': return <LogBlock block={block} />
    case 'error': return <ErrorBlock block={block} />
    case 'limit': return <LimitBlock block={block} />
    case 'diff': return <DiffBlock block={block} />
    case 'summary': return <SummaryBlock block={block} />
    case 'permission': return <PermissionBlock block={block} onReply={onPermissionReply} />
    case 'delete': return <DeleteBlock block={block} />
    case 'research': return <ResearchBlock block={block} />
    default:
      // §0.13 — bentuk tak dikenal: jangan buang, tampilkan log mentah (tanpa `any`)
      const fallback: FluxBlock = {
        ...block,
        kind: 'log',
        payload: {
          kind: 'log',
          title: 'content:unknown',
          lines: [{ cls: 'info', text: JSON.stringify(block.payload) }],
          total: 1,
        },
      }
      return <LogBlock block={fallback} />
  }
}
