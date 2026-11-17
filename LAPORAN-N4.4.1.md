# Laporan Lengkap — N4.4.1 Penutup N4.4 (flux-webui)

**Status:** SELESAI. Tidak melanjutkan ke N5 (per instruksi Prompt N4.4.1).  
**Commit:** `9c0fe0bcc4f6d95520847ba78ecc7ec1acd66ff4`  
**Cabang:** `main`  
**Remote:** `origin` → `https://github.com/ErixDimension/opencode2-android-apk.git`  
**Verifikasi:** `git ls-remote origin refs/heads/main` == lokal HEAD (`9c0fe0b`), working tree bersih.  
**Build:** `npm run build` EXIT=0.  
**Harness:** `scripts/verify-n44.mjs` → **SEMUA PASS (H0-H15)**.  
**Adapter:** `127.0.0.1:28572` via registry (bukan hardcode). Harness pakai instance scratch port 28599 + state sendiri, tidak menyentuh 28572/28571/28570/20128.

---

## Ringkasan

Audit first-hand Muse atas commit `176991f` menemukan 5 perbaikan terlokalisir + 2 kecil. Semua diterapkan, dibangun (EXIT=0), diverifikasi harness H0–H15 semua PASS, commit `9c0fe0b` dipush, ls-remote == HEAD.

---

## Detail per butir perbaikan

### Butir 1 — Rename jujur (bug) + removeSession tidak diam-diam gagal

**Masalah:** `renameSession` sebelumnya `await updateSession(id, { title }); return { ok: true }` — mengabaikan hasil `{ok, status}` dari `updateSession`, sehingga PATCH 404 upstream tampil sebagai sukses dan form menutup seolah berhasil ("berpura-pura tersimpan", dilarang §7.5).

**Bukti kode (`src/lib/sessionStore.ts`):**
```ts
async renameSession(id: string, title: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await updateSession(id, { title })
    if (!res.ok) {
      // §7.5 — PATCH /api/session/:id → 404 upstream: degradasi jujur,
      // jangan berpura-pura tersimpan. Chip error di SessionCard tampil.
      return { ok: false, error: `Gagal mengganti judul (server ${res.status}).` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Gagal mengganti judul.' }
  }
}
```

**removeSession:** sebelumnya `await deleteSession(id)` dalam try/catch yang tidak pernah tertangkap karena `deleteSession` tidak melempar pada status HTTP non-204 (mengembalikan `{ok, status}`). Sekarang:
```ts
const res = await deleteSession(id)
if (!res.ok || res.status !== 204) {
  const msg = `Gagal menghapus sesi (server ${res.status}).`
  this.#set({ sessionsError: msg })
  throw new Error(msg)
}
```
Non-204 dicatat ke `sessionsError` (tampil di daftar + tombol Muat ulang), tidak disamarkan sebagai sukses.

**Harness H14 (source):** `renameSession memeriksa status hasil updateSession` → PASS (`renameStatus=true`).

### Butir 2 — Bar utilisasi UsageSheet width string persen

**Masalah:** `style={{ width: pct != null ? pct : 0 }}` — angka polos dirender React sebagai px, bukan %, sehingga bar konteks tidak lebar menurut persen.

**Perbaikan (`src/components/UsageSheet.tsx`):**
```tsx
<div className={`fx-usage-sheet__bar-fill ${ctxClass(pct)}`}
     style={{ width: pct != null ? `${pct}%` : 0 }} />
```
Sama pola dengan ctxline kartu (`width: \`${contextPct ?? 0}%\``) yang sudah benar.

**Harness H14:** `UsageSheet width string persen (\`${pct}%\`)` → PASS (`widthPct=true`).

### Butir 3 — Menu "Izin tersimpan" sungguhan (§8.5 WAJIB)

**Probe hasil (apa adanya):**
- `GET /api/permission/saved` → 200, 257 aturan (termasuk wildcard `:*:*` dan pola `*` lain). Dibuktikan H13.
- `DELETE /api/permission/saved/:id` dengan id palsu → **204**. (Tidak terbukti menghapus aturan NYATA — bisa idempoten.)
- `DELETE /api/permission/:id` dengan id palsu → 404.
- `POST /api/permission/saved` (coba buat aturan uji sendiri) → **404**. Tidak bisa membuat aturan milik sendiri untuk diuji hapusnya.
- **DILARANG** menghapus aturan milik Erix, termasuk wildcard `:*:*`.

**Kesimpulan:** mekanisme cabut **tidak terbukti** pada aturan nyata (tidak bisa membuat aturan sendiri; dilarang mencoba pada aturan Erix). → Daftar Izin tersimpan tampil **read-only**, tanpa tombol cabut, keterbatasan ditulis dalam UI dan laporan. Tidak berpura-pura bisa mencabut.

**Implementasi:** komponen baru `src/components/PermissionSavedList.tsx` — tabel aturan (action/resource/effect per aturan), aturan wildcard (resource mengandung `*`) ditandai kolom "wildcard" + baris berkelas `fx-permission-saved-list__row--wildcard`. Dipanggil dari kepala daftar sesi (`SessionList.tsx`): tombol "Izin tersimpan" → `getPermissionSaved()` → render daftar.

**Kode (`src/components/SessionList.tsx`):**
```tsx
<button type="button" onClick={() => { void loadSavedRules(); setSavedOpen(true) }}>
  Izin tersimpan
</button>
```
```ts
const loadSavedRules = useCallback(async () => {
  try {
    const rules = await getPermissionSaved()
    setSavedRules(rules)
  } catch {
    setSavedRules([])
  }
}, [])
```

**Harness H15:** `daftar Izin tersimpan ter-wire ke getPermissionSaved dari SessionList` → PASS (`savedWired=true`, sumber mengandung `getPermissionSaved` dan `PermissionSavedList`).

### Butir 4 — Status PROSES untuk sesi latar (§7.3/7.4)

**Masalah:** `run = isActive && activeRun` — hanya sesi aktif yang terlacak; sesi latar yang sedang bekerja tampil idle, padahal memantau sesi latar adalah inti panel.

**Probe hasil (apa adanya):** Record sesi dari `GET /api/session` **tidak ada field status/busy** (hanya `id`, `title`, `model`, `tokens`, `outcome`, `time`, `location`, `cost`, `projectID`, `agent`). Upstream tidak menyediakan status per-sesi lewat REST. → Sinyal tersedia hanya dari event SSE `session.*` (penanda mulai/selesai yang sudah dikenali store: `session.execution.started/step.started/text.started` → busy; `...succeeded/failed/step.ended/text.ended` → idle). Tanpa event → idle (jujur, tidak diarang).

**Perbaikan (`src/lib/sessionStore.ts`):**
- State baru `sessionBusy: Record<string, boolean>`.
- `#wireEvents` ditulis ulang: penanda busy per-sesi diproses untuk **semua** sessionID (bukan hanya aktif), sebelum guard `sessionID !== activeID`. Event start → `sessionBusy[sessionID] = true`; end → `false`. Untuk sesi aktif juga `#requestRefetch('busy-idle')`.
- `SessionCard` terima prop `isBusy`; `run = isBusy || (isActive && activeRun)` — spinner, "Sedang bekerja", titik pulse `fx-pulse-dots` 1,2s, sweep `fx-sweep` 2s tampil juga untuk sesi latar busy. `data-state` = `run|active|idle`.
- `SessionList` sediakan `isBusy={state.sessionBusy[s.id] ?? false}`.
- `SessionBar` badge hitung semua sesi busy: `Object.values(state.sessionBusy).filter(Boolean).length` (belum "hanya aktif; jujur, tidak diarang").

**Catatan kejujuran:** status per-sesi bergantung pada event SSE `session.*`; bila event tidak sampai (tidak terhubung), tampil idle. Tidak ada angka status yang diprakarsa.

### Butir 5 — Antrean + cakupan permission diluruskan (§8.1)

**Masalah:** Indikator antrean harfiah `1 dari {1}` (angka palsu). Baris cakupan Always teks generik.

**Perbaikan:** `pendingPermission` di store sekarang **antre (array)**:
```ts
pendingPermission: { requestID: string; sessionID: string; tool: string; input: string }[]
```
`openPermissionSheet(pending: {...}[])`. Sheet menampilkan antrian pertama + indikator nyata `1 dari ${queueTotal}` (bukan literal `1 dari {1}`). Baris cakupan Always: `Cakupan Always: <tool> + <ringkasan input sesuai data upstream>` (ditampilkan sebelum tekan), bukan teks generik.

**Harness H15:** `antre permission bukan literal 1 dari {1}` → PASS (`queueReal=true`, sumber tidak mengandung `1 dari {1}` dan mengandung `dari ${`).

### Butir 6 — Kecil

**(a)** Dihapus baris meta permanen `(ketuk model: ganti tidak didukung server)` dari kartu — pesan tidak didukung cukup muncul saat tombol model diketook (jalur `modelError` sudah ada, degradasi jujur §7.7).  
**(b)** Kartu sesi AKTIF (bukan sedang run) mendapat tombol **"Statistik sesi"** di area menu pensil → `sessionStore.openUsageSheet()`, membuka `.fx-usage-sheet` (overlay di Shell, sumber tunggal `usageOpen` via store, juga dipakai Underbar di ChatColumn).

---

## Hasil harness `scripts/verify-n44.mjs` (VERBATIM)

```
PASS H0 build npm run build EXIT=0: exit 0; tail:  | ✓ built in 616ms
PASS H0 adapter scratch sehat di port 28599: /healthz 200
PASS setup/login scratch adapter berhasil + cookie berlaku: setup status 200
PASS login scratch adapter 200 + cookie berlaku: cookie terima
PASS H1 GET /api/session via adaptor + cookie → 200 dan > 0 sesi: status 200, jumlah 39
PASS H2 daftar sesi adaptor === upstream langsung: adaptor 39 vs upstream 39, id set sama: true
PASS H3 POST /api/session membuat sesi baru → id kembali: status 200, id ses_e153…
PASS H4a POST /api/session/:id/prompt 200: status 200
PASS H4b balasan assistant tiba dalam 120 detik: pesan terakhir 2, assistant=true
PASS H5 GET / layanan dist terbaru + asset cocok file dist lokal: root 200, asset 2, masalah: -
PASS H6 GET /api/session tanpa cookie → 401: status 401
PASS H7 tidak ada getState() saat render di komponen: bersih
PASS H8 putaran 1 berbalas: baseline 1, sekarang 6
PASS H8 putaran 2 berbalas: baseline 1, sekarang 6
PASS H9 SKIP-TIDAK-DIDUKUNG: ganti model sesi berjalan tidak didukung upstream: PATCH /api/session/:id → 404 (degradasi jujur)
PASS H10 .fx-sessionbar di atas .fx-col, SessionDrawer pensiun: bar=true col=true noDrawer=true
PASS H10 .fx-session-list meluncur (data-open) + .fx-session-card [data-state]: list=true card=true states=true
PASS H10 kelas panel sesi + usage terkirim ke dist: {"fx-sessionbar":true,"fx-session-list":true,"fx-session-card":true,"fx-underbar":true,"fx-usage-sheet":true} underbar=true usage=true
PASS H11 animasi run: spinner 0,9s (fx-spin-card), titik pulse 1,2s (fx-pulse-dots), sweep 2s (fx-sweep): spin=true pulse=true sweep=true
PASS H11 teks "Sedang bekerja" + sweep bar tak terduga pada kartu run: runText=true
PASS H12 POST /api/session (judul + direktori) → 200: status dibuat=200, id=ses_e1
PASS H12 DELETE /api/session/:id → 204: status hapus=204
PASS H12 sesi tidak lagi dalam daftar (tidak diam-diam gagal): masih ada=false
PASS H13 .fx-permission-sheet: 3 tombol (ALLOW ONCE / ALWAYS ALLOW / REJECT) + antre "1 dari N" + cakupan Always sebelum tekan: sheet=true buttons=true queue=true scope=true
PASS H13 .fx-card-alert (lencana izin sesi latar) + hasil kedaluwarsa ditampilkan apa adanya: alert=true results=true
PASS H13 GET /api/permission/saved → 200 (aturan izin tersimpan): status 200, aturan=257
PASS H14 renameSession memeriksa status hasil updateSession (tidak ok:true tanpa syarat): renameStatus=true
PASS H14 UsageSheet width string persen (`${pct}%`): widthPct=true
PASS H15 daftar Izin tersimpan ter-wire ke getPermissionSaved dari SessionList: savedWired=true
PASS H15 antre permission bukan literal 1 dari {1}: queueReal=true
HASIL: SEMUA PASS (H0-H15)
```

Exit code harness: 0.

---

## File yang berubah (commit `9c0fe0b`)

Baru: `LAPORAN-N4.4.md`, `src/components/PermissionSavedList.tsx`.  
Diubah: `scripts/verify-n44.mjs`, `src/components/ChatColumn.tsx`, `PermissionSheet.tsx`, `SessionCard.tsx`, `SessionList.tsx`, `Shell.tsx`, `UsageSheet.tsx`, `src/lib/sessionStore.ts`, `src/styles/spine-flux.css`.

Laporan ini sengaja **tidak di-commit** agar kondisi akhir tetap `ls-remote origin refs/heads/main` == lokal HEAD `9c0fe0b` pada commit penutup. STOP — tidak ada N5.
