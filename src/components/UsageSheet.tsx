// UsageSheet.tsx — §7.10: lembar statistik sesi (SESSION USAGE) meluncur dari
// bawah, menimpa kolom chat yang diredupkan. Biaya: "Pricing unavailable" —
// tidak ada angka karangan (model :free via 9Router). Rincian per model
// dihitung dari pesan assistant yang membawa model + tokens per pesan; bila
// tidak ada, agregat tunggal berlabel model sesi — tidak pecah secara karangan.
import { X } from 'lucide-react'
import { useSessionStore } from '../lib/useSessionStore'
import { modelDisplayName } from '../lib/modelDisplayName'

interface Props {
  onClose: () => void
}

function formatTokens(t: number | null | undefined): string {
  if (t == null) return '—'
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}J`
  if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K`
  return String(t)
}

function ctxClass(p: number | null | undefined): string {
  if (p == null) return ''
  if (p >= 95) return 'critical'
  if (p >= 80) return 'warn'
  return 'cyan'
}

export function UsageSheet({ onClose }: Props) {
  const state = useSessionStore()
  const active = state.active
  const pct = state.contextPercent
  const limit = state.modelContextLimit
  const tokens = active?.tokens
  const total = tokens ? tokens.input + tokens.output + tokens.reasoning : null

  // Rincian per model dari pesan assistant (model + tokens per pesan ada di data).
  const byModel = new Map<string, { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number }>()
  for (const m of state.messages) {
    if (m.type !== 'assistant') continue
    const key = m.model.id
    const cur = byModel.get(key) ?? { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }
    cur.input += m.tokens.input
    cur.output += m.tokens.output
    cur.reasoning += m.tokens.reasoning
    cur.cacheRead += m.tokens.cache.read
    cur.cacheWrite += m.tokens.cache.write
    byModel.set(key, cur)
  }

  return (
    <div className="fx-usage-sheet" role="dialog" aria-modal="true" aria-label="Statistik sesi" onClick={(e) => e.stopPropagation()}>
      <div className="fx-usage-sheet__head">
        <span className="fx-usage-sheet__title">Session <span>usage</span></span>
        <button type="button" onClick={onClose}>
          <X size={18} /> tutup
        </button>
      </div>
      <div className="fx-usage-sheet__body">
        <div className="fx-usage-sheet__row">
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fx-text)' }}>{active?.title ?? '(tanpa judul)'}</span>
        </div>
        <div className="fx-usage-sheet__row">
          <span className="fx-usage-sheet__label">Estimated API cost</span>
          <div className="fx-usage-sheet__cost">Pricing unavailable — model :free via 9Router, tidak ada angka harga yang ditampilkan.</div>
        </div>
        <div className="fx-usage-sheet__row">
          <span className="fx-usage-sheet__label">Context utilization</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span className={`fx-usage-sheet__util-num ${ctxClass(pct)}`}>
              {pct != null ? pct + '%' : '—'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--fx-muted)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
              {total != null && limit ? `(${formatTokens(total)} input token)` : ''}
            </span>
          </div>
          <div className="fx-usage-sheet__bar">
            <div className={`fx-usage-sheet__bar-fill ${ctxClass(pct)}`} style={{ width: pct != null ? `${pct}%` : 0 }} />
          </div>
          <div className="fx-usage-sheet__tokens">
            {total != null && limit != null ? `${formatTokens(total)} of ${formatTokens(limit)} input tokens` : 'batas konteks tidak tersedia'}
          </div>
        </div>
        <div className="fx-usage-sheet__row">
          <span className="fx-usage-sheet__label">Rincian per model</span>
          {byModel.size === 0 ? (
            <div className="fx-usage-sheet__model">
              <span className="fx-usage-sheet__model-name" title={active?.model?.id ?? undefined}>
                {modelDisplayName(active?.model?.id) || '(tidak diketahui)'}
              </span>
              <div className="fx-usage-sheet__model-stat">
                in {formatTokens(tokens?.input)} · out {formatTokens(tokens?.output)} · reasoning {formatTokens(tokens?.reasoning)}
                {'\n'}cache read {formatTokens(tokens?.cache?.read)} · cache write {formatTokens(tokens?.cache?.write)}
              </div>
            </div>
          ) : (
            [...byModel.entries()].map(([modelID, s]) => (
              <div key={modelID} className="fx-usage-sheet__model">
                <span className="fx-usage-sheet__model-name" title={modelID}>{modelDisplayName(modelID)}</span>
                <div className="fx-usage-sheet__model-stat">
                  in {formatTokens(s.input)} · out {formatTokens(s.output)} · reasoning {formatTokens(s.reasoning)}
                  {'\n'}cache read {formatTokens(s.cacheRead)} · cache write {formatTokens(s.cacheWrite)}
                </div>
              </div>
            ))
          )}
          {state.cursor?.next && (
            <div className="fx-usage-sheet__note">
              Catatan kejujuran: rincian mencakup riwayat yang termuat (pesan lebih lama
              termuat per halaman melalui kursor).
            </div>
          )}
        </div>
        {(pct != null && pct >= 80) && (
          <div className="fx-usage-sheet__row">
            <span className="fx-usage-sheet__suggestion">
              Saran pasif: pertimbangkan sesi baru + minta ringkasan (bukan pop-up).
            </span>
          </div>
        )}
      </div>
      <div className="fx-usage-sheet__footer" />
    </div>
  )
}
