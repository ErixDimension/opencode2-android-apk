// Composer.tsx — §4.5: kapsul, cairan konteks --ctx, model pill, STOP/interrupt,
// mode edit (revert staging §0.14), placeholder mengikuti status.

import * as React from 'react'
import { useState, type FormEvent } from 'react'
import { ArrowUp, StopCircle, Monitor, RotateCcw } from 'lucide-react'
import { sessionStore } from '../lib/sessionStore'
import { useSessionStore } from '../lib/useSessionStore'

export function Composer() {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [editBase, setEditBase] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)

  const state = useSessionStore()

  const stop = () => { sessionStore.interrupt() }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSendError(null)
    const t = text.trim()
    if (!t) return
    try {
      if (editing) {
        await sessionStore.sendPrompt(t)
        sessionStore.revertCommit()
        setEditing(false)
        setEditBase('')
        setText('')
      } else {
        await sessionStore.sendPrompt(t)
        setText('')
      }
    } catch (err) {
      // Error kirim TIDAK diam: tampilkan sebagai chip/blok error di kolom chat.
      setSendError(err instanceof Error ? err.message : 'Gagal mengirim prompt.')
    }
  }

  const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value)

  const cancelEdit = () => { setText(editBase); setEditing(false) }

  const live = state.activeRun
  const placeholder = live ? 'Agent bekerja…' : editing ? 'Mengedit percobaan…' : 'Tulis pesan…'

  return (
    <>
      <div className="fx-composer" data-ctx-high={state.contextPercent != null && state.contextPercent > 90 ? 'true' : 'false'} style={{ '--ctx': `${state.contextPercent ?? 0}%` } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-2 mb-1 text-xs text-slate-500 font-mono">
        <span className="flex items-center gap-1"><Monitor size={12} /> {state.modelLabel}</span>
        <span>{state.contextPercent != null ? `konteks ${state.contextPercent}%` : 'konteks —'}</span>
      </div>
      <form onSubmit={onSubmit} className="fx-composer-inner">
        <textarea
          className="fx-textarea"
          value={text}
          onChange={onChange}
          placeholder={placeholder}
          disabled={live && !editing}
          rows={1}
          spellCheck={false}
        />
        {live && !editing ? (
          <button type="button" className="fx-stop" onClick={stop} title="Hentikan stream (interrupt)"><StopCircle size={20} /></button>
        ) : editing ? (
          <>
            <button type="button" className="fx-send" onClick={onSubmit} disabled={!text.trim()} title="Kirim ulang"><RotateCcw size={16} /></button>
            <button type="button" className="fx-send" style={{ background: 'transparent', color: 'var(--fx-muted)', borderColor: 'var(--fx-border)' }} onClick={cancelEdit} title="Batal">X</button>
          </>
        ) : (
          <button type="submit" className="fx-send" disabled={!text.trim()} title="Kirim"><ArrowUp size={16} /></button>
        )}
      </form>
      {editing && (
        <div className="fx-edit-bar">
          <button type="button" onClick={() => { sessionStore.revertClear(); setEditing(false) }} title="Kembalikan teks asli">REVERT</button>
          <button type="button" onClick={cancelEdit} title="Buang mode edit">BATAL</button>
          <button type="button" onClick={onSubmit} disabled={!text.trim()} title="Kirim ulang sebagai percobaan baru">KIRIM ULANG</button>
        </div>
      )}
    </div>
    {sendError && (
      <div className="mt-2 font-mono text-xs text-rose-400 bg-rose-900/30 border border-rose-500/30 rounded-lg p-2 whitespace-pre-wrap break-words">
        ✗ {sendError}
      </div>
    )}
    </>
  )
}
