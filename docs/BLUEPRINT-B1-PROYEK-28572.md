# BLUEPRINT B1 — PROJECT 28572 (dari nol)

> **Status:** DISETUJUI erix pada 17 Nov 2026 (sudah direview, "cukup memuaskan untuk tahap ini"). Nama folder `flux-webui` DIKUNCI (D1 tidak lagi usulan). Keputusan D1–D12 terkunci; perubahan hanya lewat keputusan baru erix.
> **Basis fakta:** laporan B0 — audit source + definisi binary + query SQLite read-only, runtime NOT TESTED. Semua rujukan `server.cjs:NNN` dll. mengacu pada project LAMA sebagai bukti, bukan sebagai bahan salinan.
> **Aturan yang mengikat seluruh blueprint ini:** folder berbeda, adapter berbeda, launcher berbeda; tidak ada kode project lama yang disalin; yang dipakai dari B0 hanyalah PENGETAHUAN kontrak upstream.

---

## 1. Temuan B0 yang Menentukan Desain

1. **Adapter lama ternyata bukan backend.** Dia hanya reverse proxy tipis penjaga kredensial (server.cjs ±940 baris; route miliknya cuma login/logout, connections, default-location, dan gerbang FS policy). Backend sebenarnya adalah **OpenCode service di 127.0.0.1:28570** (versi `2.0.0-android-termux.2`), ditemukan lewat **registry** `~/.local/state/opencode/service-android-termux.json` (isi: id, version, url, pid, password). Port 4096 adalah jalur native/TUI terpisah — **bukan** jalur web; meng-hardcode 4096 adalah jebakan yang harus dihindari.
2. **Pertanyaan binary terjawab.** Binary yang cocok sudah terpasang dan terbukti: service `opencode2` dari paket guysoft. Project baru tidak mencari binary baru — dia berbicara ke service yang sama lewat registry, persis seperti lingkungan menyediakan engine-nya.
3. **9Router bukan lawan bicara adapter.** Adapter lama tidak pernah bicara ke 9Router. Alurnya: launcher menyinkronkan daftar model 9Router (0.0.0.0:20128, OpenAI-compatible `/v1`) ke `~/.config/opencode/opencode.json`, lalu OpenCode sendiri yang memanggil 9Router sebagai provider. Database 9Router: `~/.9router/db/data.sqlite`. Konsekuensi: adapter baru juga TIDAK butuh klien 9Router; yang butuh peran 9Router adalah **launcher** (health check + sync model).
4. **SSE upstream bersifat global dan volatile.** `GET /api/event` adalah satu aliran lintas semua sesi/location. Frame normal berformat `event: message`; tipe event yang sebenarnya ada di field `type` di dalam JSON envelope `{id, created, metadata?, type, durable?, location?, data}`. `durable = {aggregateID, seq, version}` (v1 default; v2 untuk `session.deleted`, `session.forked`, `session.instructions.updated`, `session.tool.success`, `session.tool.failed`). Tidak ada replay dan tidak ada Last-Event-ID: event saat disconnect hilang, dan pemulihan dilakukan lewat **refetch REST** (pola lama: event = sinyal, lalu debounce refetch 300/400 ms + rekonsiliasi).
5. **Filter SSE adapter lama cacat desain (jangan ditiru):** (a) semua event tanpa `sessionID` dibuang — `server.connected`, `shell.*`, `pty.*`, `form.*`, `workspace.*`, `worktree.*`, `mcp.*`, `vcs.*`, `file.edited` tidak pernah sampai ke UI; (b) komentar heartbeat `:` ikut dibuang karena `JSON.parse('')` gagal, sehingga watchdog 45 detik memicu reconnect palsu saat idle; (c) ada cabang else-if "fail closed" yang nyatanya fail-open (laten: event lintas sesi bisa lolos bila upstream suatu saat mengirim named event).
6. **Tidak ada watcher backend — Live Sync lama adalah polling frontend murni** (`liveSync.ts`: browser 900/2500 ms, tree 1200/3000 ms, maks. 24 direktori, cache listing fsClient TTL 5 detik). Event `file.edited` upstream hanya mencakup edit oleh tool, bukan perubahan eksternal.
7. **Endpoint filesystem adalah milik OpenCode** (`/api/fs/list`, `/api/fs/read/*`, `/api/fs/find`, dengan query `location[directory]` deepObject). Nilai tambah adapter hanyalah gerbang policy: allowlist root (Termux Home, `/storage/emulated/0`, rootfs PRoot), blokir `Android/data|obb|media`, normalisasi alias (`~/storage`, `/sdcard`, …), dan validasi realpath tetap-di-dalam-root.
8. **Fitur video punya dukungan upstream nyata:** revert bukan karangan UI — ada `POST /api/session/:id/revert/stage|clear|commit` dan event `session.revert.staged|cleared|committed`; stop = `POST /api/session/:id/interrupt`; permission = event `permission.asked` + `POST …/permission/:requestID/reply`; edit pesan asisten selesai = `PATCH …/message/:messageID`.
9. **Katalog event v2 jauh lebih kaya daripada yang dipakai UI lama** — `session.text.*`, `session.reasoning.*`, `session.step.*`, `session.execution.*`, `session.usage.*`, `session.compaction.*`, `session.inbox.*`, `session.diff` selama ini tidak punya konsumen. Untuk SPINE//FLUX ini tambang emas: hampir setiap jenis blok di video punya sumber event aslinya.
10. **Cacat lama lain yang tidak boleh diwarisi:** `backendAuth` dihitung sekali saat startup (rotasi password backend → semua request 401 → UI logout paksa); `getMessages()` tidak mengirim `order/limit/cursor` (urutan diasumsikan, sesi panjang bisa terpotong page default); proxy membuang header `Content-Disposition/ETag/Range/Content-Length` (download & conditional request rusak); cookie `Max-Age` 12 jam tetap vs sesi server 30 hari tanpa sliding renewal.

---

## 2. Keputusan Arsitektur (dikunci di B1)

| # | Keputusan | Alasan |
|---|-----------|--------|
| D1 | Nama folder DIKUNCI: **`/data/data/com.termux/files/home/flux-webui`** | Pendek, identitas SPINE//FLUX, jelas berbeda dari `opencode2-webui`. Dipilih erix 17 Nov 2026. |
| D2 | Adapter baru bind **127.0.0.1:28572**, Node.js, satu file entry `server.mjs` + modul kecil seperlunya | Port sesuai keputusan erix; Node terbukti di Termux; ditulis segar. |
| D3 | Adapter baru bicara ke **OpenCode service yang sama** (28570) lewat **registry** — URL + password dibaca dari registry, dan **dibaca ulang saat upstream menjawab 401** | Sesi & data chat adalah milik engine dan dipakai bersama kedua UI selama masa transisi; membaca ulang registry menambal cacat lama #6/B0. Dilarang hardcode 4096 maupun 28570 tanpa registry. |
| D4 | **Satu engine, dua wajah.** Project baru tidak menjalankan OpenCode service kedua dan tidak memakai database kedua | Database kedua = data terbelah. Service & DB adalah lingkungan bersama. |
| D5 | Nama cookie adapter baru: **`flux_session`** (HttpOnly, SameSite=Strict, Path=/) | Cookie TIDAK mengenal port — cookie `ocweb_session` milik 28571 akan ikut terkirim ke 28572 di host yang sama. Nama berbeda mencegah tabrakan sesi antar dua UI. |
| D6 | SSE diteruskan **utuh sebagai aliran global**: adapter tidak membuang event tanpa sessionID dan tidak membuang komentar heartbeat; pemilahan per sesi dilakukan frontend dari field `type`/`data.sessionID` di envelope JSON | Menambal cacat B0 §3.3/§6 #1–#3. Filter di adapter (bila kelak perlu untuk fan-out) wajib fail-closed dan berbasis isi envelope, bukan nama frame SSE. |
| D7 | Pola state frontend: **event = sinyal, REST = kebenaran** (debounce refetch + rekonsiliasi), dan pemanggilan message list selalu eksplisit `order` + `limit` + `cursor` | Pola lama yang terbukti (B0 (b)11) + menambal cacat pagination lama. |
| D8 | Gerbang FS policy ditulis segar di adapter baru dengan filosofi allowlist yang sama (root, blokir, alias, realpath) | Endpoint fs adalah milik upstream; policy adalah nilai tambah adapter. |
| D9 | Fitur **connections** (multi-server) adapter lama **TIDAK** masuk scope project baru untuk sekarang | Project baru hanya bicara ke service lokal. Mengurangi permukaan risiko; bisa ditambah kelak sebagai phase tersendiri bila erix meminta. |
| D10 | Live Sync v1 = polling frontend adaptif (pola terbukti); **watcher di adapter = phase peningkatan (N6)**, bukan MVP | Menghindari janji berlebihan di Android; urutan: benar dulu, baru cepat. |
| D11 | Stack frontend: **React + TypeScript + Vite + Tailwind + Lucide**, ditulis dari nol; `vite.config` memakai `base: './'` | Stack yang sama karena terbukti di Termux dan erix menguasainya; `base './'` menyiapkan jalur APK (D12) tanpa utak-atik kelak. |
| D12 | Siklus hidup produk: **web = versi maintenance; APK = pengemasan** dari `dist/` web terakhir yang lulus uji, dan APK mencatat hash build web yang dikemasnya | Sesuai rencana erix 17 Nov 2026. |

---

## 3. Arsitektur Target

```
Browser / WebView (APK kelak)
   │  cookie flux_session (HttpOnly)
   ▼
ADAPTER BARU  127.0.0.1:28572        ← project flux-webui/server.mjs
   │  • sajikan dist/ frontend baru
   │  • login/logout + sesi adapter (memori)
   │  • gerbang FS policy untuk /api/fs/* & /api/find
   │  • relay SSE global TANPA membuang event/heartbeat
   │  • proxy /api/* dengan header policy yang benar
   │  Authorization: Basic opencode:<registry.password>  (tidak pernah ke browser)
   ▼
OpenCode service  127.0.0.1:28570    ← lingkungan bersama (registry: service-android-termux.json)
   │
   ├── SQLite ~/.local/share/opencode/opencode-android-termux.db  (sesi & pesan: sumber kebenaran)
   └── provider 9router ──► 9Router 0.0.0.0:20128 ──► ~/.9router/db/data.sqlite

LAUNCHER BARU (milik flux-webui, terpisah dari oc-web)
   • cek registry + health OpenCode service (GET /api/health, Basic) — tidak menduplikasi service
   • cek health 9Router (GET /v1/models) — menyalakan hanya bila belum hidup (service bersama)
   • (N7) sync model 9Router → opencode.json dengan pola aman: lock, hash no-op, backup, atomic write
   • start/stop/status adapter 28572 (setsid), PID/log di ~/.local/state/flux-webui/
```

---

## 4. Spesifikasi Adapter Baru

**Route milik adapter (hanya ini yang bukan proxy):**
- `POST /login`, `POST /logout` — pola keamanan lama sebagai referensi desain: timing-safe compare, lockout per IP (5 gagal → 60 detik), sesi memori (idle 12 jam, absolut 30 hari, maks. 32, eviksi tertua), token terikat hash password (rotasi password menginvalidasi sesi), cookie sliding renewal (menambal cacat lama: Max-Age disegarkan pada aktivitas).
- `GET /healthz` — health adapter sendiri untuk launcher baru (status, versi build, upstream reachable ya/tidak). Route baru yang tidak menabrak path upstream.
- Gerbang policy untuk `/api/fs/*` dan `/api/find` (validasi `location[directory]`, allowlist, realpath) sebelum diteruskan.
- Relay `GET /api/event` (lihat aturan SSE di bawah).
- Sisanya: static `dist/` + SPA fallback, dan proxy generik `/api/*`.

**Aturan proxy:** target dibangun dari registry URL; Authorization selalu disuntikkan adapter (header Authorization dari browser tidak pernah diteruskan); body dibatasi (login 4 KiB, umum 2 MiB); abort dari client dipropagasikan ke upstream; **header respons yang dipertahankan diperluas** dibanding lama: Content-Type, Content-Disposition, ETag, Last-Modified, Content-Length, Accept-Ranges/Content-Range, Cache-Control (menambal B0 §6 #14); 401 dari upstream TIDAK diteruskan mentah ke UI — adapter membaca ulang registry dan mencoba sekali lagi; bila tetap 401, kembalikan 502 dengan kode khusus `UPSTREAM_AUTH` agar UI tidak salah mengira pengguna logout.

**Aturan relay SSE:** satu koneksi upstream per client yang terhubung (sederhana dan benar dulu; fan-out satu-koneksi-untuk-semua = optimasi kelak); frame diteruskan apa adanya termasuk komentar heartbeat; adapter tidak mem-parse untuk membuang — parsing hanya untuk logging diagnostik opsional; buffer wajar dengan overflow policy eksplisit (putus + beri tahu client, jangan diam-diam membuang); disconnect client → abort upstream.

**Yang TIDAK dimiliki adapter:** penyimpanan pesan/sesi chat (semua di upstream), klien 9Router, route connections.

---

## 5. Spesifikasi Frontend Baru (SPINE//FLUX native)

**Struktur:** `.fx-shell` dua kolom (chat + sekat Work Explorer) mengikuti blueprint rekonstruksi; satu file `spine-flux.css` berisi sistem token & class `.fx-*` (ditulis segar dari dokumen desain, bukan menyalin file project lama); tanpa header Runtime di atas — panel terisi penuh.

**Pemetaan event upstream → blok tulang chat (sumber: katalog B0 §3.2):**

| Blok SPINE//FLUX | Sumber data/event |
|---|---|
| Blok teks streaming (`is-live`) | `session.text.started/delta/ended` + REST message saat rekonsiliasi |
| Blok thought (amber) | `session.reasoning.started/delta/ended` |
| Blok tool/code/command | `session.tool.input.*`, `session.tool.called/progress/success/failed` — terima KEDUA varian error: `session.tool.failed` (v2) dan `session.tool.success` + `metadata.error:true` (historis) |
| Penanda step | `session.step.started/streamed/ended/failed` |
| Status run | `session.execution.started/succeeded/failed/interrupted`, `session.status`, `session.idle` |
| Blok permission | `permission.asked` → tombol balas → `POST …/permission/:requestID/reply`; `permission.replied/rejected` menutup blok |
| Percobaan & revert | `session.revert.staged/cleared/committed` + endpoint revert; composer masuk mode edit dari state ini |
| Blok compaction | `session.compaction.started/delta/ended/failed`, `session.compacted` |
| Diff | `session.diff` |
| Usage | `session.usage.recorded/updated` (baris ringkasan) |
| Sinyal global | `server.connected` → resync penuh (di UI lama event ini tidak pernah sampai — di sini wajib berfungsi) |
| Auto Follow Work Explorer | `session.tool.*` (path file dari payload) + `shell.created/exited` → reducer aktivitas → satu `activeTarget` |

**Klien data:** typed client untuk route inti B0 §7 A2/A3 (session CRUD, prompt, interrupt, revert, permission, message dengan order/cursor eksplisit, model/agent/provider untuk pemilih di composer); stream client berbasis fetch + reader (bukan EventSource — perlu header & kontrol), backoff 1s→30s + jitter, watchdog yang MENGENALI komentar heartbeat sebagai tanda hidup.

**Composer:** kirim = `POST /api/session/:id/prompt`; STOP = `POST …/interrupt`; mode edit (revert staged) dengan tampilan teks lama dicoret / teks baru, tombol REVERT/BATAL/KIRIM ULANG mengikuti state revert upstream; ringkasan selesai + **Salin Ringkasan** dari data pesan (clipboard API + fallback untuk WebView).

**Work Explorer (perilaku R5.5.2, dibangun native):** strip DETEKSI PROJECTS paling atas (dari `/api/project` + fs nyata, tanpa project palsu, tanpa tombol Back), di bawahnya navigasi global terkunci (HOME ROOT, mata Auto Follow, Search Path yang terhubung ke filter tree), Home Root Tree ↔ Project Root Tree, animasi segitiga 1,5 detik menyembunyikan navigasi sementara follow tetap hidup, divider geser/lipat, baris tools hanya berisi aksi yang benar-benar ada (buka file → panel baca via `/api/fs/read`), Search Path = filter render atas node termuat (batasan jujur yang sama seperti yang terbukti di 28571), Auto Follow dari `activeTarget` tunggal + beam SVG terjangkar rect asli (tanpa beam palsu).

---

## 6. Spesifikasi Launcher Baru

- File milik project baru (mis. `bin/flux-web`), terpisah total dari `oc-web` lama; perintah: `start | stop | status | restart`.
- Idempotent dan berbasis health check: tidak pernah memulai duplikat adapter di 28572; tidak pernah memulai OpenCode service/9Router kedua — keduanya service bersama, launcher hanya MEMASTIKAN hidup (memulai hanya bila mati, dengan cara yang sama seperti lingkungan menujukannya).
- PID/log milik sendiri: `~/.local/state/flux-webui/flux-webui.pid` + `flux-webui.stderr.log` — tidak berbagi file state dengan project lama.
- Verifikasi pasca-start: adapter menjawab di `/healthz` dan halaman login termuat.
- Dilarang: menyentuh PID/proses/launcher project lama (28571), menulis ke folder project lama.

---

## 7. Phase Pembangunan

Setiap phase: backup tidak relevan (project baru), tetapi setiap phase berakhir dengan laporan bukti + `tsc`/build bila menyentuh frontend, dan status jujur PASS/FAIL/NOT TESTED. Runtime hanya dinyatakan PASS setelah TEST A (N8).

| Phase | Isi | Gerbang selesai |
|---|---|---|
| **N0 — Probe runtime** | Menutup unknown kritis B0 §(c) secara read-only terhadap upstream bersama: capture mentah SSE idle ≥60 detik (framing persis + interval heartbeat), contoh respons `GET /api/config`, uji `GET …/message` tanpa query vs `order=asc` (default & page size), contoh body error 400/404/409/500, cek `GET /api/health`. Hasil = adendum tertulis untuk B1. | 5 unknown kritis terjawab dengan bukti capture |
| **N1 — Scaffold** | Buat folder `flux-webui`, `package.json` (react, react-dom, typescript, vite, tailwindcss, lucide-react), tsconfig, vite config (`base './'`), `index.html`, adapter kerangka yang menyajikan halaman placeholder di 28572, launcher kerangka (start/stop/status). | Launcher start/stop bersih; `http://127.0.0.1:28572` termuat; 28571 tidak terganggu |
| **N2 — Adapter inti** | Registry reader (+ baca ulang saat 401), login/logout/sesi/cookie `flux_session`, security headers, static serving, proxy generik dengan header policy D-perbaikan, gerbang FS policy. | Login jalan; `GET /api/session` ter-proxy; fs list di dalam root OK, di luar root 403; 401 upstream tidak membuat UI logout |
| **N3 — Relay SSE** | Relay global utuh + stream client frontend (backoff, watchdog sadar heartbeat, bus internal satu koneksi). | `server.connected` benar-benar tiba; idle 60 detik tanpa reconnect palsu; event global tidak hilang |
| **N4 — Chat SPINE//FLUX** | Daftar sesi, render blok bertipe dari REST + event, streaming text/reasoning/tool, permission ask/reply, composer (prompt, STOP/interrupt), revert stage/commit + mode edit, ringkasan + Salin. | Satu percakapan penuh: kirim → stream → tool → permission → selesai → salin; stop di tengah jalan; revert/edit/kirim ulang |
| **N4.3 — Penuntasan chat** | Kunci sisa N4.2 (hook reaktif + bootstrap berurutan), polling penjemput balasan + latch SSE diperbaiki, error kirim tampil, pemilih model terbukti (atau degradasi jujur). | Harness H0–H9 hijau; dua putaran prompt berbalas terjemput store; ls-remote == HEAD |
| **N4.4 — Panel sesi + usage + interaksi** | SPEC Bagian 7 (bar tipis + daftar kartu + dialog sesi baru), §7.10 (Session Usage + `.fx-underbar`), Bagian 8 (popup permission 3 tombol + fitur question) + Lampiran 8.5. | Discovery kontrak terbukti; harness diperluas (H10–H13) hijau; TEST A panel oleh Erix |
| **N5 — Work Explorer** | Deteksi project, dua root tree, navigasi terkunci + segitiga, Search Path, Auto Follow + beam, divider, panel baca file. | Semua adegan Work Explorer di video HD terverifikasi di runtime |
| **N6 — Live Sync watcher** | Watcher fs di adapter (debounce ±400 ms, batas direktori terpantau, fallback polling) → event `fs.changed` di channel adapter sendiri. | File diubah dari luar OpenCode → tree berubah tanpa refresh manual; polling lama tetap jadi fallback |
| **N7 — Launcher lengkap** | Kepemilikan sync model 9Router (implementasi segar pola aman: lock, hash no-op, backup, atomic write, mirror), status gabungan (adapter + upstream + 9Router). | Restart HP/Termux → satu perintah launcher menghidupkan seluruh rantai 28572 |
| **N8 — TEST A 28572** | Checklist runtime penuh di browser/WebView `127.0.0.1:28572`: semua adegan video + regresi (login, sesi lama terbaca, permission, stop, revert, copy, follow saat nav tersembunyi, search). | Semua item PASS dengan screenshot; sisanya dicatat FAIL/NOT TESTED secara jujur |
| **N9 — Jalur APK** (nanti, setelah web stabil) | Kemas `dist/` terakhir ke shell WebView; catat hash build web di dalam APK. | APK membuka UI yang sama persis dengan web versi tercatat |

**Di luar scope sampai ada keputusan baru:** fitur connections multi-server (D9), mengganti/menonaktifkan project 28571, mengubah konfigurasi 9Router (termasuk bind 0.0.0.0-nya — temuan keamanan B0 §6 #11 dicatat, bukan diperbaiki diam-diam), menyentuh database OpenCode secara langsung.

---

## 8. Unknown B0 yang Dibawa ke B1

16 unknown B0 §(c) dipetakan: #2 (schema `/api/config`), #3 (schema projected message & fs), #4 (default order/page size), #5 (framing SSE persis), #7 (interval heartbeat) → **ditutup di N0**. #6 (query sessionID di `/api/event`) → tidak relevan lagi karena desain D6 memakai aliran global. #8 (replay via session log experimental) → keputusan: tidak dipakai di MVP (pola REST rekonsiliasi cukup); dievaluasi ulang setelah N4. #9/#10 (auth & capabilities 9Router) → diverifikasi read-only di N7 sebelum sync diambil alih. #11 (rotasi password) → sudah ditambal secara desain (D3 + aturan proxy). #13 (watcher native) → dijawab oleh desain N6 (watcher milik adapter sendiri). #14 (kepemilikan lifecycle 28572) → dijawab §6 blueprint ini. #15 (bentuk error body) → contoh ditangkap di N0; klien wajib menoleransi error berupa string maupun object. #16 (kompresi/range) → header policy §4; verifikasi di N2. #1 & #12 → melekat pada seluruh phase (runtime dibuktikan bertahap, `/api/health` dipakai launcher sejak N1).

---

*Akhir blueprint B1 — menunggu persetujuan erix. Setelah disetujui: prompt N0 disusun sebagai pekerjaan pertama sesi pembangunan.*

---

## 9. Revisi 2026-11-17 (Malam) — Panel Sesi Diterima [MENGIKAT]

- Erix **MENERIMA** desain daftar sesi dari video **`panel-sesi-flow.mp4`** (36,5 dtk): satu bar sesi full-width yang ditipiskan maksimal + daftar berbentuk kartu + animasi proses sederhana + alur rename / delete / ganti model / sesi baru (dialog berisi server, project, working directory, nama, model, run-in, start). Video itu dan mockup pendampingnya (`session-list-cards.png`, `thin-panel-chat.png`, `new-session-dialog.png`) adalah referensi visual mengikat untuk wilayah panel sesi, berdampingan dengan video HD untuk kolom chat.
- Konsekuensi: keputusan SPEC-DESAIN-N4 Bagian 0 #1 (laci geser `.fx-drawer` + `.fx-corner-btn`) **GUGUR**. Spec konkret penggantinya: **SPEC-DESAIN-N4 Bagian 7**.
- Tabel phase §7 berubah: sisipkan **N4.3 — Penuntasan chat** (balasan terjemput via polling + pemilih model terbukti; sedang berjalan saat revisi ini ditulis) dan **N4.4 — Panel sesi** (implementasi SPEC Bagian 7; gerbang: harness diperluas + TEST A panel) di antara N4 dan N5. **HOLD tetap berlaku**: N5 tidak mulai sebelum N4.3 + N4.4 diterima Erix.
- Caveat tercatat: (a) Run in `New worktree` hanya berfungsi bila upstream terbukti mendukung — discovery N4.4 yang memutuskan; (b) pilihan SERVER saat ini berisi lokal saja (pilihan nyata menyusul jalur multi-server/APK); (c) rename/delete/ganti model memakai endpoint upstream yang wajib dibuktikan di discovery N4.4, dengan degradasi jujur bila tidak tersedia.
- **Session Usage: DITERIMA Erix (23:44 WIB)** — fungsi meniru contoh screenshot-nya, kulit SPINE//FLUX; penempatan anti-menumpuk: lembar dari strip konteks di bawah composer (`.fx-underbar`) + bar mini di kaki kartu sesi; interior composer DIPESAN untuk fitur plan/build mendatang (SPEC Bagian 7.10 kini MENGIKAT dan masuk gerbang N4.4).
- **Popup permission + fitur question: DITERIMA Erix (23:58 WIB)** — permission naik dari kartu dua tombol menjadi popup auto tiga tombol (Allow once / Always allow / Reject) dengan kartu tulang tetap sebagai catatan; question adalah fitur baru (lembar pilihan jawaban dari agent + status MENUNGGU JAWABAN di kartu). Spec konkret: SPEC-DESAIN-N4 Bagian 8 (Bagian 0 #3 diperluas). Keduanya masuk scope N4.4 dengan discovery kontrak wajib — mekanisme `always` dan question belum terbukti di upstream.
- **Peta permission project lama diterima (2026-11-18 00:07 WIB)**: endpoint request/saved + payload `once`/`always` yang pernah teruji + temuan aturan wildcard yang menelan Reject — dilampirkan sebagai bahan discovery di SPEC Bagian 8.5 (pengetahuan protokol; tetap wajib verifikasi ulang ke upstream live). Question dipastikan belum pernah diimplementasikan di mana pun dan endpoint-nya tidak diketahui.
