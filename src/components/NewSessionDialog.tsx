// NewSessionDialog.tsx — §7.8: lembar sesi baru dari bawah.
// SERVER (lokal Termux saja), PROJECT, WORKING DIRECTORY, lalu NAMA SESI →
// PILIH MODEL (radio, daftar dari upstream /api/model) → RUN IN: Local (default).
// "New worktree" disembunyikan: isolasi worktree belum terbukti upstream discovery.
// START CHAT → POST /api/session {title, model, directory} (terbukti 200).
import { useState, useEffect, useCallback } from 'react'
import { sessionStore } from '../lib/sessionStore'
import { getModelList } from '../lib/apiClient'
import { X, Play } from 'lucide-react'

interface Props {
  onClose: () => void
}

export function NewSessionDialog({ onClose }: Props) {
  const [models, setModels] = useState<{ id: string; providerID: string }[]>([])
  const [title, setTitle] = useState('')
  const [directory, setDirectory] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadModels = useCallback(async () => {
    try {
      const list = await getModelList()
      setModels(list)
      if (list.length > 0 && !selected) setSelected(list[0].id)
    } catch {
      // daftar model gagal: dialog tetap bisa dikirim tanpa model (upstream default)
    }
  }, [selected])

  useEffect(() => {
    void loadModels()
  }, [loadModels])

  const handleStart = async () => {
    setError(null)
    if (!title.trim()) {
      setError('Nama sesi wajib diisi.')
      return
    }
    setLoading(true)
    try {
      const init: { title: string; model?: { id: string; providerID: string }; directory?: string } = {
        title: title.trim(),
        directory: directory.trim() || undefined,
      }
      const model = models.find((m) => m.id === selected)
      if (model) init.model = { id: model.id, providerID: model.providerID }
      await sessionStore.createAndActivateWithInit(init)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat sesi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fx-permission-sheet" role="dialog" aria-modal="true" aria-label="Sesi baru" onClick={(e) => e.stopPropagation()}>
      <div className="fx-permission-sheet__head">
        <span className="fx-permission-sheet__title">Sesi baru</span>
        <button type="button" onClick={onClose}>
          <X size={18} /> tutup
        </button>
      </div>
      <div className="fx-permission-sheet__body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fx-cyan)' }}>SERVER</span>
          <span style={{ fontSize: '12px', fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--fx-text)' }}>Lokal (Termux)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fx-cyan)' }}>PROJECT</span>
          <span style={{ fontSize: '12px', fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--fx-muted)' }}>— (tidak terisolasi)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fx-cyan)' }}>WORKING DIRECTORY</label>
          <input
            className="fx-textarea"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            placeholder="(default upstream)"
            style={{ marginTop: 4, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fx-cyan)' }}>NAMA SESI</label>
          <input
            className="fx-textarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. pengujian flux 1"
            style={{ marginTop: 4, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fx-cyan)' }}>PILIH MODEL</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {models.map((m) => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={selected === m.id}
                  onChange={() => setSelected(m.id)}
                />
                <span style={{ fontSize: '12px', fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--fx-text)' }}>{m.id}</span>
                <span style={{ fontSize: '11px', color: 'var(--fx-muted)' }}>{m.providerID}</span>
              </label>
            ))}
            {models.length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--fx-muted)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                (daftar model tidak tersedia — upstream default)
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fx-cyan)' }}>RUN IN</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--fx-text)' }}>
            <input type="radio" name="runin" value="local" defaultChecked={true} readOnly={true} />
            Local (default)
          </label>
          <span style={{ marginLeft: 8, fontSize: '11px', color: 'var(--fx-red)' }}>
            New worktree disembunyikan (belum terbukti upstream)
          </span>
        </div>
        {error && <div className="fx-unsupported-chip" style={{ marginTop: 10 }}>{error}</div>}
      </div>
      <div className="fx-permission-actions">
        <button type="button" onClick={onClose}>Batal</button>
        <button type="button" className="allow-once" onClick={handleStart} disabled={loading || !title.trim()}>
          <Play size={16} /> {loading ? 'Membuat…' : 'START CHAT'}
        </button>
      </div>
    </div>
  )
}
