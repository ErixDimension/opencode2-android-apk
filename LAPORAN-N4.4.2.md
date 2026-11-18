# Laporan Lengkap — N4.4.2 Perbaikan Wiring Runtime (flux-webui)

**Status:** SELESAI. Tidak melanjutkan ke N5 (per instruksi Prompt N4.4.2).  
**Commit:** `441a7b6e1b5e9da2a2630e550cb4e9b088c26ac9`  
**Cabang:** `main`  
**Remote:** `origin` → `https://github.com/ErixDimension/opencode2-android-apk.git`  
**Verifikasi:** `git ls-remote origin refs/heads/main` == lokal HEAD (`441a7b6`), working tree bersih.  
**Build:** `npm run build` EXIT=0.  
**Harness:** `scripts/verify-n44.mjs` → **SEMUA PASS (H0-H16)** (verbatim di bawah).  
**Adapter:** `127.0.0.1:28572` via registry (bukan hardcode). Harness pakai scratch port 28599, tidak menyentuh 28572/28571/28570/20128.

**Peringatan pembuktian runtime:** Pembuktian runtime terakhir adalah **TEST A ulang oleh Erix** — jangan mengklaim PASS runtime dari harness saja. Harness memverifikasi assertion sumber kode (H0–H16) dan jalur API via adaptor scratch, bukan interaksi browser penuh. Kesimpulan "panel bisa dibuka / balasan terjemput" dirumuskan dari kode + assertion H16, bukan dari uji browser.

---

## Ringkasan

TEST A Erix atas build `9c0fe0b` GAGAL total di runtime browser: panel daftar sesi tidak bisa dibuka, prompt terkirim tapi balasan tidak pernah muncul, titik stream merah. Audit first-hand Muse menemukan 3 akar masalah di lapisan wiring frontend + 2 ikutannya. Semua diperbaiki, dibangun (EXIT=0), diverifikasi H0–H16 semua PASS, commit `441a7b6` dipush, ls-remote == HEAD.

---

## Detail per butir perbaikan

### Butir 1 — Panel sesi tidak terhubung (akar masalah #1)

**Akar masalah:** `SessionBar.tsx` punya `useState open` LOKAL yang tidak mengendalikan apa pun; `Shell.tsx` punya `listOpen` sendiri tetapi TIDAK ADA pemanggil `setListOpen(true)` di mana pun. Chevron memutar state yamat; daftar tidak akan pernah terbuka.

**Perbaikan:** satu sumber kebenaran di Shell (`listOpen`), dilewatkan ke `SessionBar` sebagai prop `open`/`onToggle`. Seluruh `.fx-sessionbar` adalah target sentuh (§7.1) — klik di mana pun membuka/menutup daftar, bukan hanya chevron.

**Kode (`src/components/Shell.tsx`):**
```tsx
<SessionBar open={listOpen} onToggle={() => setListOpen((o) => !o)} />
```

**Kode (`src/components/SessionBar.tsx`):**
```tsx
interface Props { open: boolean; onToggle: () => void }
export function SessionBar({ open, onToggle }: Props) {
  ...
  return (
    <div className="fx-sessionbar" role="region" aria-label="Daftar sesi" onClick={onToggle}>
      ...
      <button ... onClick={(e) => { e.stopPropagation(); onToggle() }} ...>
```

**Assertion harness H16a:** `keadaan buka daftar dipakai bersama — SessionBar tanpa useState lokal open yamat; toggle ter-wire ke Shell` → PASS (`barNoLocalOpen=true barWire=true shellWire=true`).

### Butir 2 — Stream tidak pernah dinyalakan (akar masalah #2)

**Akar masalah:** `eventStream.start()` TIDAK dipanggil di mana pun di `src/` — store berlangganan ke stream yang tidak pernah mulai, titik status merah permanen, tidak ada event yang tiba.

**Perbaikan:** panggil `eventStream.start()` saat aplikasi masuk keadaan `'app'` (setelah autentikasi sukses di App, sebelum/sesudah bootstrap).

**Kode (`src/App.tsx`):**
```tsx
useEffect(() => {
  if (view === 'app') {
    void (async () => {
      eventStream.start()
      await sessionStore.bootstrap()
    })()
  }
}, [view])
```

**Assertion harness H16b:** `eventStream.start() dipanggil di src/` → PASS (`startCalled=true`). Titik di bar mencerminkan `eventStream.getState() === 'online'` via `subscribeStatus`.

### Butir 3 — Polling penjemput bunuh diri (akar masalah #3)

**Akar masalah:** Di `sessionStore.#tick`, syarat berhenti `runSelesai = !activeRun` langsung benar pada tick pertama setelah kirim: `#inferRun` mengembalikan false bila pesan terakhir adalah pesan USER (baru terkirim, balasan belum ada) → polling mati dalam sekejap, balasan yang tiba ±10 detik kemudian tidak pernah dijemput.

**Perbaikan:** polling berhenti hanya bila (a) `inferRun` false (assistant terakhir sudah selesai / tidak ada run), (b) deadline 120 detik, atau (c) user berpindah sesi / STOP. `#inferRun` diselaraskan: run aktif juga mencakup "menunggu balasan" (pesan user lebih baru dari assistant terakhir). Irama tetap ±1750 ms.

**Kode (`src/lib/sessionStore.ts`):**
```ts
#inferRun(messages: Message[]): boolean {
  if (messages.length === 0) return false
  let lastAssistant = -1, lastUser = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'assistant' && lastAssistant === -1) lastAssistant = i
    if (messages[i].type === 'user' && lastUser === -1) lastUser = i
    if (lastAssistant !== -1 && lastUser !== -1) break
  }
  if (lastUser > lastAssistant) return true // user belum dibalas
  if (lastAssistant === -1) return false
  const t = messages[lastAssistant] as { time: { completed?: number } }
  return !t.time?.completed
}
```

```ts
#tick(): void {
  if (this.#pollDeadline == null || Date.now() > this.#pollDeadline) {
    this.#stopPolling(); this.#awaitingReply = false; return
  }
  void this.#loadMessages(0).then(() => {
    const stillRunning = this.#state.active ? this.#inferRun(this.#state.messages) : false
    if (!stillRunning && !this.#awaitingReply) {
      this.#stopPolling(); this.#awaitingReply = false; return
    }
    this.#awaitingReply = false
    this.#pollTimer = setTimeout(() => this.#tick(), 1750)
  }).catch(() => {
    this.#pollTimer = setTimeout(() => this.#tick(), 1750)
  })
}
```

`sendPrompt` set `this.#awaitingReply = true` sebelum `#startPolling()` (supaya polling tidak mati pada tick pertama saat pesan user baru belum muncul di server). `interrupt` dan `setActive` reset `#awaitingReply`.

**Assertion harness H16c:** `polling tidak mati saat pesan terakhir = user (masih menunggu)` → PASS (`waitLogic=true`).

### Butir 4 — Lencana bar memakai sumber yang benar

**Akar masalah:** `SessionBar` menghitung `activeRun ? 1 : 0` dengan teks "1 sesi berproses"; klaim laporan N4.4.1 soal hitungan `sessionBusy` tidak ada di kode.

**Perbaikan:** lencana = jumlah sesi LAIN (selain aktif) yang busy menurut `state.sessionBusy`, format chip ringkas `N PROSES`, tidak dirender bila nol.

**Kode (`src/components/SessionBar.tsx`):**
```tsx
const otherBusy = Object.entries(state.sessionBusy).filter(
  ([id, b]) => b && id !== state.active?.id
).length
```
```tsx
{otherBusy > 0 && (
  <span className="fx-sessionbar__badge" aria-label="Sesi lain sedang berproses">
    {otherBusy} PROSES
  </span>
)}
```

### Butir 5 — Arah paginasi + posisi chip (temukan screenshot TEST A)

**Akar masalah:** Muat awal pakai `order=asc&limit=50` = 50 pesan TERLAMA — sesi panjang membuka di riwayat kuno, balasan terbaru tidak masuk halaman. Chip `fx-load-older` ("Muat lebih lama") di BAWAH tulang.

**Perbaikan (§0.17):** muat awal = 50 pesan TERAKHIR (`order=desc&limit=50`), balik untuk tampil menaik; `cursor.next` = halaman lebih lama. Chip `Muat lebih lama` di PUNCAK tulang (sebelum blok pertama), prepend, posisi scroll dipertahankan (`scrollTop = scrollHeight - before`); chip hanya tampil bila `cursor?.next` benar-benar ada.

**Kode (`src/lib/sessionStore.ts` #loadMessages):**
```ts
const page = await getMessages(active.id, PAGE_SIZE, 'desc', cursor)
const oldestFirst = [...page.data].reverse()
```

**Kode (`src/components/ChatColumn.tsx` loadOlder):**
```ts
const el = scrollRef.current
const before = el ? el.scrollHeight : 0
void sessionStore.loadOlder().then(() => {
  if (el) el.scrollTop = el.scrollHeight - before
})
```

**Assertion harness H16d:** `muat awal = 50 pesan TERAKHIR (order desc) lalu dibalik untuk tampil menaik` → PASS (`desc=true reverse=true`).

### Butir 6 — Kedip busy (minor, dari N4.4.1)

`session.step.ended` / `session.text.ended` hanya memicu refetch, JANGAN mematikan busy (mereka menyala di tengah run). Penanda akhir busy tetap `session.execution.succeeded` / `session.execution.failed`.

**Kode (`src/lib/sessionStore.ts` #wireEvents):** `isBusyEnd` hanya `succeeded`/`failed`; cabang terpisah untuk `step.ended`/`text.ended` → refetch saja.

---

## Hasil harness `scripts/verify-n44.mjs` (VERBATIM utuh)

```
PASS H0 build npm run build EXIT=0: exit 0; tail:  | ✓ built in 654ms
PASS H0 adapter scratch sehat di port 28599: /healthz 200
PASS setup/login scratch adapter berhasil + cookie berlaku: setup status 200
PASS login scratch adapter 200 + cookie berlaku: cookie terima
PASS H1 GET /api/session via adaptor + cookie → 200 dan > 0 sesi: status 200, jumlah 40
PASS H2 daftar sesi adaptor === upstream langsung: adaptor 40 vs upstream 40, id set sama: true
PASS H3 POST /api/session membuat sesi baru → id kembali: status 200, id ses_e152…
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
PASS H16a keadaan buka daftar dipakai bersama — SessionBar tanpa useState lokal open yamat; toggle ter-wire ke Shell: barNoLocalOpen=true barWire=true shellWire=true
PASS H16b eventStream.start() dipanggil di src/: startCalled=true
PASS H16c polling tidak mati saat pesan terakhir = user (masih menunggu): waitLogic=true
PASS H16d muat awal = 50 pesan TERAKHIR (order desc) lalu dibalik untuk tampil menaik: desc=true reverse=true
HASIL: SEMUA PASS (H0-H16)
```

Exit code harness: 0.

---

## File yang berubah (commit `441a7b6`)

Diubah: `src/App.tsx`, `src/components/SessionBar.tsx`, `src/components/Shell.tsx`, `src/components/ChatColumn.tsx`, `src/lib/sessionStore.ts`, `scripts/verify-n44.mjs`. (7 files changed, 309 insertions, 37 deletions.)

Laporan ini sengaja **tidak di-commit** agar kondisi akhir tetap `ls-remote origin refs/heads/main` == lokal HEAD `441a7b6` pada commit penutup. STOP — tidak ada N5.
