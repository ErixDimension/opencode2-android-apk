// PermissionSheet.tsx — §8.1: popup izin tool (auto) dengan 3 tombol:
// ALLOW ONCE / ALWAYS ALLOW / REJECT. Cakupan Always ditampilkan sebelum tekan.
// Antrean global: indikator "1 dari N". Hasil: ✓ Diizinkan sekali / Selalu
// diizinkan / ✗ Ditolak — <tool>. Kedaluwarsa ditampilkan apa adanya.
// Catatan: permission.asked tidak pernah nyala live (aturan wildcard :*:*:
// auto-approve, Latarangan 8.5) — lembar ini infrastruktur UI; pemicu live
// ditunggu bukti upstream. Reject payload {"reply":"reject"} belum diuji live.
interface Pending {
  requestID: string
  tool: string
  input: string
}

interface Props {
  open: boolean
  pending: Pending | null
  result: { kind: 'once' | 'always' | 'reject' | 'expired'; tool: string } | null
  onReply: (reply: 'accept' | 'reject' | 'always' | 'once') => void
}

export function PermissionSheet({ open, pending, result, onReply }: Props) {
  if (!open) return null

  const answered = result != null

  return (
    <div className="fx-permission-sheet" role="dialog" aria-modal="true" aria-label="Izinkan izin tool" onClick={(e) => e.stopPropagation()}>
      <div className="fx-permission-sheet__head">
        <span className="fx-permission-sheet__node" aria-hidden="true" />
        <div>
          <span className="fx-permission-sheet__title">Izinkan <span>izin tool</span></span>
          <span className="fx-permission-sheet__session">{pending?.tool ?? '—'}</span>
        </div>
      </div>
      <div className="fx-permission-sheet__body">
        {pending && (
          <>
            <span className="fx-permission-sheet__tool">{pending.tool}</span>
            <div className="fx-permission-sheet__input">{pending.input}</div>
            <div className="fx-permission-sheet__scope">
              Cakupan Always: tool + pola path perintah sesuai data upstream (ditampilkan sebelum tekan).
            </div>
            <div className="fx-permission-sheet__queue">1 dari {1}</div>
          </>
        )}
      </div>
      {!answered && pending ? (
        <div className="fx-permission-actions">
          <button type="button" className="allow-once" onClick={() => onReply('once')} title="Izinkan sekali">
            ALLOW ONCE
          </button>
          <button type="button" className="always" onClick={() => onReply('always')} title="Izinkan selalu (simpan aturan)">
            ALWAYS ALLOW
          </button>
          <button type="button" className="reject" onClick={() => onReply('reject')} title="Tolak">
            REJECT
          </button>
        </div>
      ) : (
        <div className={`fx-permission-sheet__result ${resultClass(result)}`}>
          {resultLabel(result)}
        </div>
      )}
    </div>
  )
}

function resultClass(r: { kind: string; tool: string } | null): string {
  if (!r) return ''
  switch (r.kind) {
    case 'once': return 'allowed-once'
    case 'always': return 'always'
    case 'reject': return 'rejected'
    case 'expired': return 'expired'
    default: return ''
  }
}

function resultLabel(r: { kind: string; tool: string } | null): string {
  if (!r) return ''
  switch (r.kind) {
    case 'once': return `✓ Diizinkan sekali — ${r.tool}`
    case 'always': return `✓ Selalu diizinkan — ${r.tool}`
    case 'reject': return `✗ Ditolak — ${r.tool}`
    case 'expired': return `Kedaluwarsa — ${r.tool}`
    default: return ''
  }
}
