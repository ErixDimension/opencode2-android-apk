// Shell.tsx — §4.2: setelah login, satu kolom chat penuh + laci daftar sesi.
// Tanpa header strip; siap dibungkus .fx-shell di N5.

import { SessionDrawer } from './SessionDrawer'
import { ChatColumn } from './ChatColumn'
import { sessionStore } from '../lib/sessionStore'
import { useSessionStore } from '../lib/useSessionStore'

export function Shell() {
  const state = useSessionStore()
  const onSelect = (sessionID: string) => {
    void sessionStore.setActive(sessionID)
  }

  const onNew = async () => {
    await sessionStore.createAndActivate()
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#09090b] text-[#f4f4f5]">
      <SessionDrawer
        sessions={state.sessions}
        active={state.active}
        sessionsError={state.sessionsError}
        onSelect={onSelect}
        onNew={onNew}
        onRetry={() => { void sessionStore.loadSessions() }}
      />
      <div className="flex-1 min-h-0">
        <ChatColumn />
      </div>
    </div>
  )
}
