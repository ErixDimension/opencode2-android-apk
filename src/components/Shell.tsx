// Shell.tsx — §7.11 (N4.4): `.fx-sessionbar` di atas `.fx-col`, menggantikan
// SessionDrawer (pensiun). Tidak ada header strip; siap dibungkus .fx-shell di N5.
import { useState, useCallback } from 'react'
import { ChatColumn } from './ChatColumn'
import { SessionBar } from './SessionBar'
import { SessionList } from './SessionList'
import { NewSessionDialog } from './NewSessionDialog'
import { PermissionSheet } from './PermissionSheet'
import { sessionStore } from '../lib/sessionStore'
import { useSessionStore } from '../lib/useSessionStore'

export function Shell() {
  const state = useSessionStore()
  const [listOpen, setListOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  const onNew = useCallback(() => {
    setListOpen(false)
    setNewOpen(true)
  }, [])

  return (
    <div className="fx-app-shell">
      <SessionBar />

      {listOpen && (
        <>
          <div className="fx-sessionlist-backdrop" onClick={() => setListOpen(false)} />
          <SessionList
            onClose={() => setListOpen(false)}
            onNew={onNew}
          />
        </>
      )}

      {newOpen && (
        <>
          <div className="fx-sessionlist-backdrop" onClick={() => setNewOpen(false)} />
          <NewSessionDialog onClose={() => setNewOpen(false)} />
        </>
      )}

      <div className="fx-col">
        <ChatColumn />
      </div>

      {state.permissionOpen && (
        <>
          <div className="fx-permission-backdrop" onClick={() => sessionStore.closePermissionSheet()} />
          <PermissionSheet
            open={state.permissionOpen}
            pending={state.pendingPermission}
            result={state.permissionResult}
            onReply={(reply) => {
              const requestID = state.pendingPermission?.requestID
              const tool = state.pendingPermission?.tool ?? 'tool'
              if (!requestID) return
              void sessionStore.replyPermission(requestID, reply).then(() => {
                sessionStore.setPermissionResult(reply === 'accept' ? 'once' : reply, tool)
              })
            }}
          />
        </>
      )}
    </div>
  )
}
