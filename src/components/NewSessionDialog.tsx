// NewSessionDialog.tsx — §7.8 (N4.4.3): lembar ringkas dengan kelas sendiri
// (.fx-newsession*), tidak lagi meminjam .fx-permission-sheet. Kepala + kaki
// tetap; tengah tidak scroll sebagai satu halaman; hanya kotak model yang
// scroll (±180px). Urutan: SERVER → PROJECT → WORKING DIRECTORY → ① NAMA →
// ② MODEL → ③ RUN IN → kaki (Batal / START CHAT). "New worktree" disembunyikan
// (isolasi worktree belum terbukti upstream). START CHAT → POST /api/session.
import { useState, useEffect } from 'react'
import { sessionStore } from '../lib/sessionStore'
import { useSessionStore } from '../lib/useSessionStore'
import { getModelList } from '../lib/apiClient'
import { X, Play } from 'lucide-react'

interface Props {
  onClose: () => void
}

export function NewSessionDialog({ onClose }: Props) {
  const state = useSessionStore()
  const [models, setModels] = useState<{ id: string; providerID: string }[]>([])
  const [title, setTitle] = useState('')
  const [directory, setDirectory] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeModelID = state.active?.model?.id

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const list = await getModelList()
        if (!alive) return
        setModels(list)
        // Bawaan: model sesi aktif bila ada di daftar; selain itu item pertama.
        const preferred = list.find((m) => m.id === activeModelID) ?? list[0]
        if (preferred) setSelected((prev) => prev ?? preferred.id)
      } catch {
        // daftar model gagal: dialog tetap bisa dikirim tanpa model (upstream default)
      }
    })()
    return () => { alive = false }
  }, [activeModelID])

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
    <div className="fx-newsession" role="dialog" aria-modal="true" aria-label="Sesi baru" onClick={(e) => e.stopPropagation()}>
      <div className="fx-newsession__head">
        <span className="fx-newsession__title">Sesi baru</span>
        <button type="button" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
      </div>

      <div className="fx-newsession__body">
        <div className="fx-newsession__row">
          <span className="fx-newsession__label">SERVER</span>
          <label className="fx-newsession__radio">
            <input type="radio" name="server" checked readOnly />
            Lokal (Termux)
          </label>
        </div>

        <div className="fx-newsession__row">
          <span className="fx-newsession__label">PROJECT</span>
          <span className="fx-newsession__value">— (tidak terisolasi)</span>
        </div>

        <label className="fx-newsession__field">
          <span className="fx-newsession__label">WORKING DIRECTORY</span>
          <input
            className="fx-textarea"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            placeholder="(default upstream)"
          />
        </label>

        <label className="fx-newsession__field">
          <span className="fx-newsession__label">① NAMA SESI</span>
          <input
            className="fx-textarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. pengujian flux 1"
          />
        </label>

        <div className="fx-newsession__field">
          <span className="fx-newsession__label">② PILIH MODEL</span>
          <div className="fx-newsession__models">
            {models.map((m) => (
              <label key={m.id} className="fx-newsession__model">
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={selected === m.id}
                  onChange={() => setSelected(m.id)}
                />
                <span className="fx-newsession__model-id">{m.id}</span>
                <span className="fx-newsession__model-provider">{m.providerID}</span>
              </label>
            ))}
            {models.length === 0 && (
              <span className="fx-newsession__models-empty">
                (daftar model tidak tersedia — upstream default)
              </span>
            )}
          </div>
        </div>

        <div className="fx-newsession__row">
          <span className="fx-newsession__label">③ RUN IN</span>
          <label className="fx-newsession__radio">
            <input type="radio" name="runin" value="local" checked readOnly />
            Local (default)
          </label>
        </div>

        <span className="fx-newsession__note">
          New worktree disembunyikan (belum terbukti upstream)
        </span>

        {error && <div className="fx-unsupported-chip">{error}</div>}
      </div>

      <div className="fx-newsession__footer">
        <button type="button" onClick={onClose}>Batal</button>
        <button
          type="button"
          className="primary"
          onClick={handleStart}
          disabled={loading || !title.trim()}
        >
          <Play size={16} /> {loading ? 'Membuat…' : 'START CHAT'}
        </button>
      </div>
    </div>
  )
}
