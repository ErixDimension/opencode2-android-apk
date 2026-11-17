// SessionDrawer.tsx — §0.1: laci geser kiri, daftar sesi, tombol corner + status SSE.

import { useState, useEffect, useCallback } from 'react'
import { Layers, Plus } from 'lucide-react'
import { eventStream } from '../lib/eventStream'
import { type SessionView } from '../lib/sessionStore'

interface Props {
  sessions: SessionView[]
  active: SessionView | null
  onSelect: (sessionID: string) => void
  onNew: () => void
}

export function SessionDrawer({ sessions, active, onSelect, onNew }: Props) {
  const [open, setOpen] = useState(false)
  const [online, setOnline] = useState(eventStream.getState() === 'online')

  useEffect(() => {
    const off = eventStream.subscribeStatus((status) => setOnline(status.state === 'online'))
    return () => off()
  }, [])

  const toggle = useCallback(() => setOpen((o) => !o), [])

  return (
    <>
      <button className="fx-corner-btn" onClick={toggle} title="Daftar sesi" aria-label="Daftar sesi">
        <Layers size={18} />
        <span className={`fx-corner-btn__dot ${online ? 'online' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="fx-drawer" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="fx-drawer__overlay" onClick={() => setOpen(false)} />
          <div className="fx-drawer__panel">
            <div className="fx-drawer__head">
              <span className="fx-drawer__title">Daftar <span>sesi</span></span>
            </div>
            <div className="fx-drawer__list">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  className="fx-session-row"
                  data-active={s.id === active?.id ? 'true' : 'false'}
                  onClick={() => { onSelect(s.id); setOpen(false) }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="fx-session-row__title truncate">{s.title ?? '(tanpa judul)'}</div>
                    <div className="fx-session-row__meta">{s.location?.directory ?? ''} {s.model?.id ? '· ' + s.model.id : ''}</div>
                  </div>
                </button>
              ))}
              {sessions.length === 0 && <div className="px-16 py-4 text-xs text-slate-500 font-mono">Belum ada sesi.</div>}
            </div>
            <button className="fx-new-session" onClick={() => { onNew(); setOpen(false) }}>
              <Plus size={16} /> Sesi Baru
            </button>
          </div>
        </div>
      )}
    </>
  )
}
