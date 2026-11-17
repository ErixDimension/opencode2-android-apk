// ChatColumn.tsx — §4.3: .fx-col > .fx-scroll > .fx-spine > .fx-flow + blok-blok.
// Event SSE tidak dirender langsung; REST via sessionStore adalah kebenaran.

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { RenderBlock } from './blocks'
import { Composer } from './Composer'
import { Underbar } from './Underbar'
import { UsageSheet } from './UsageSheet'
import { sessionStore } from '../lib/sessionStore'
import { useSessionStore } from '../lib/useSessionStore'
import { replyPermission } from '../lib/apiClient'

export function ChatColumn() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const state = useSessionStore()
  const active = state.active
  const [usageOpen, setUsageOpen] = useState(false)

  const onPermissionReply = (reply: 'accept' | 'reject') => {
    const pending = state.blocks.find((b) => b.kind === 'permission' && (b.payload as { status?: string }).status === 'pending')
    if (!pending) return
    const requestID = (pending.payload as { requestID?: string }).requestID
    if (requestID && active) replyPermission(active.id, requestID, reply)
  }

  useEffect(() => {
    // Auto-scroll ke bawah saat run aktif dan user sudah dekat bawah.
    if (state.activeRun && scrollRef.current) {
      const el = scrollRef.current
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight
    }
  }, [state])

  const loadOlder = () => { sessionStore.loadOlder() }

  if (!active) {
    return (
      <div className="fx-col">
        <div className="fx-scroll">
          <div className="fx-spine">
            <div className="fx-block" data-kind="stream">
              <div className="text-slate-500 font-mono text-sm">Belum ada sesi. Buka laci (tombol sudut kiri atas) dan pilih atau buat sesi baru.</div>
            </div>
          </div>
        </div>
        <Composer />
      </div>
    )
  }

  return (
    <div className="fx-col">
      <div className="fx-scroll" ref={scrollRef}>
        <div className="fx-spine">
          <div className="fx-flow" style={{ height: `var(--fx-progress)` }} />
          {state.blocks.map((block) => (
            <React.Fragment key={block.id}>
              <RenderBlock block={block} onPermissionReply={onPermissionReply} />
            </React.Fragment>
          ))}
          {state.cursor?.next && (
            <div className="flex justify-center mb-6">
              <button className="fx-load-older" onClick={loadOlder}>Muat lebih lama</button>
            </div>
          )}
        </div>
      </div>
      <Composer />
      <Underbar onOpenUsage={() => setUsageOpen(true)} />
      {usageOpen && (
        <>
          <div className="fx-usage-backdrop" onClick={() => setUsageOpen(false)} />
          <UsageSheet onClose={() => setUsageOpen(false)} />
        </>
      )}
    </div>
  )
}
