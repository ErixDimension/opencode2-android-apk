// SessionBar.tsx — §7.1: bar sesi penuh lebar ±40px di atas kolom chat.
// Satu target sentuh (selain chevron visual); pintu masuk tunggal daftar sesi.
import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { eventStream } from '../lib/eventStream'
import { useSessionStore } from '../lib/useSessionStore'

export function SessionBar() {
  const state = useSessionStore()
  const active = state.active
  const [open, setOpen] = useState(false)
  const [online, setOnline] = useState(eventStream.getState() === 'online')

  useEffect(() => {
    const off = eventStream.subscribeStatus((status) => setOnline(status.state === 'online'))
    return () => off()
  }, [])

  const running = state.activeRun ? 1 : 0 // hanya sesi aktif yang terlacak store; jujur, tidak diarang

  return (
    <div className="fx-sessionbar" role="region" aria-label="Daftar sesi">
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
        {running > 0 && (
          <span className="fx-sessionbar__badge" aria-label="Sesi sedang berproses">
            {running} sesi berproses
          </span>
        )}
      </div>
      <button
        type="button"
        className="fx-sessionbar__chevron"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Tutup daftar sesi' : 'Buka daftar sesi'}
        aria-expanded={open}
        title={open ? 'Tutup daftar sesi' : 'Buka daftar sesi'}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
