// PermissionSavedList.tsx — §8.5: daftar Izin tersimpan (GET /api/permission/saved).
// READ-ONLY: cabut per aturan tidak dibangun karena mekanisme hapus tidak
// terbukti pada aturan nyata (DELETE /api/permission/saved/:id mengembalikan 204
// bahkan pada id palsu; tidak ada endpoint buat aturan uji sendiri (POST 404);
// dilarang mencabut aturan milik Erix, termasuk wildcard :*:*).
// Aturan berpola wildcard (resource mengandung *) ditandai jelas.
interface Rule {
  id: string
  action: string
  resource: string
  effect?: string
}

interface Props {
  open: boolean
  rules: Rule[]
  onClose: () => void
}

export function PermissionSavedList({ open, rules, onClose }: Props) {
  if (!open) return null

  const isWildcard = (resource: string) => resource.includes('*')

  return (
    <div className="fx-permission-saved-list" role="dialog" aria-modal="true" aria-label="Izin tersimpan" onClick={(e) => e.stopPropagation()}>
      <div className="fx-permission-saved-list__head">
        <span className="fx-permission-saved-list__title">Izin <span>tersimpan</span></span>
        <button type="button" onClick={onClose}>tutup</button>
      </div>
      <div className="fx-permission-saved-list__body">
        <div className="fx-permission-saved-list__note">
          {rules.length} aturan tersimpan. Daftar ini hanya dapat dibaca — cabut
          aturan belum diverifikasi upstream (lihat laporan N4.4.1 butir 3).
        </div>
        <table className="fx-permission-saved-list__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Aksi</th>
              <th>Sumber daya</th>
              <th>Efek</th>
              <th>Jenis</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="fx-permission-saved-list__empty">Belum ada aturan izin tersimpan.</td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id} className={isWildcard(r.resource) ? 'fx-permission-saved-list__row--wildcard' : ''}>
                  <td className="fx-permission-saved-list__id">{r.id}</td>
                  <td className="fx-permission-saved-list__action">{r.action}</td>
                  <td className="fx-permission-saved-list__resource">{r.resource}</td>
                  <td className="fx-permission-saved-list__effect">{r.effect ?? '—'}</td>
                  <td className="fx-permission-saved-list__kind">
                    {isWildcard(r.resource) ? 'wildcard' : 'pola'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
