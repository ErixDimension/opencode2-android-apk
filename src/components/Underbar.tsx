// Underbar.tsx — §7.10(1): strip konteks tipis di bawah composer.
// Ketuk → buka .fx-usage-sheet (lembar statistik sesi aktif). Interior composer
// tidak diisi kontrol lain (keputusan Erix 2026-11-17 23:51 WIB).
import { useSessionStore } from '../lib/useSessionStore'

function formatTokens(t: number | null | undefined): string {
  if (t == null) return '—'
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}J`
  if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K`
  return String(t)
}

export function Underbar({ onOpenUsage }: { onOpenUsage: () => void }) {
  const state = useSessionStore()
  const active = state.active
  const pct = state.contextPercent
  const total = active?.tokens ? active.tokens.input + active.tokens.output + active.tokens.reasoning : null
  const limit = state.modelContextLimit
  const cls = pct == null ? '' : pct >= 95 ? 'critical' : pct >= 80 ? 'warn' : 'ctx'

  return (
    <div className="fx-underbar" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenUsage() }} onClick={onOpenUsage} aria-label="Buka statistik sesi">
      <div className="fx-underbar__hairline" aria-hidden="true" />
      <span className="fx-underbar__label">
        konteks{' '}
        {pct != null ? (
          <>
            <span className={cls}>{pct}%</span>{' · '}
            <span className={cls}>{formatTokens(total)}</span>{' of '}
            <span className={cls}>{formatTokens(limit)}</span>
          </>
        ) : (
          <>
            <span className="ctx">—</span>{' · '}
            <span className="ctx">—</span>{' of '}
            <span className="ctx">—</span>
          </>
        )}
      </span>
    </div>
  )
}
