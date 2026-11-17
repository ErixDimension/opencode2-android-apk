// SessionBar.tsx — §7.1: bar sesi penuh lebar ±40px di atas kolom chat.
// Seluruh bar adalah target sentuh (§7.1): klik di mana pun membuka/menutup
// daftar sesi. Kondisi buka/tutup adalah satu sumber kebenaran di Shell,
// yang dilewatkan ke sini sebagai prop `open`/`onToggle` (tidak lagi state
// lokal yatim).
import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { eventStream } from '../lib/eventStream'
import { useSessionStore } from '../lib/useSessionStore'

interface Props {
  open: boolean
  onToggle: () => void
}

export function SessionBar({ open, onToggle }: Props) {
  const state = useSessionStore()
  const active = state.active
  const [online, setOnline] = useState(eventStream.getState() === 'online')

  useEffect(() => {
    const off = eventStream.subscribeStatus((status) => setOnline(status.state === 'online'))
    return () => off()
  }, [])

  // §7.3/7.4 — lencana = sesi LAIN (selain aktif) yang sedang busy menurut
  // event session.*. Format chip ringkas, tidak dirender bila nol.
  const otherBusy = Object.entries(state.sessionBusy).filter(
    ([id, b]) => b && id !== state.active?.id
  ).length

  return (
    <div className="fx-sessionbar" role="region" aria-label="Daftar sesi" onClick={onToggle}>
      <div className="fx-sessionbar__body">
        <span
          className={`fx-sessionbar__dot ${online ? 'online' : ''}`}
          aria-hidden={true}
        />
        {active ? (
          <>
            <span className="fx-sessionbar__name" title={active.title ?? ''}>
              {active.title ?? '(tanpa judul)'}
            </span>
            {active.model?.id && (
              <span className="fx-sessionbar__model" title={active.model.id}>
                · {active.model.id}
              </span>
            )}
          </>
        ) : (
          <span className="fx-sessionbar__name" style={{ color: 'var(--fx-muted)' }}>
            (tanpa sesi)
          </span>
        )}
        {otherBusy > 0 && (
          <span className="fx-sessionbar__badge" aria-label="Sesi lain sedang berproses">
            {otherBusy} PROSES
          </span>
        )}
      </div>
      <button
        type="button"
        className="fx-sessionbar__chevron"
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        aria-label={open ? 'Tutup daftar sesi' : 'Buka daftar sesi'}
        aria-expanded={open}
        title={open ? 'Tutup daftar sesi' : 'Buka daftar sesi'}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
