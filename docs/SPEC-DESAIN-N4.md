# SPEC DESAIN N4 — CHAT SPINE//FLUX (FINAL)

> **Status: FINAL** — ditinjau & difinalkan Muse, 2026-11-17. Bagian 0 memuat Keputusan Finalisasi yang MENGIKAT (memutuskan sebagian besar Pertanyaan Terbuka Bagian 6). Dokumen ini adalah kontrak desain untuk prompt eksekusi N4 — bukan prompt eksekusi itu sendiri. Tempat file ini di project: `docs/SPEC-DESAIN-N4.md`.
> **Sumber (satu-satunya dasar dokumen ini):**
> 1. `BLUEPRINT-SPINE-FLUX-CHAT-LOG.md` — blueprint kolom chat, Phase 0–10 (ditulis untuk project lama; di sini diadaptasi sebagai warisan desain).
> 2. `BLUEPRINT-REKONSTRUKSI-SPINEFLUX-WORKEXPLORER.md` — peta adegan video HD (`spine-flux-work-explorer-hd.mp4`, 1440×2560, 94 dtk — patokan visual resmi) ke komponen & phase R0–R10.
> 3. `spine-flux.css` — CSS Phase 1 (fondasi token, `.fx-col`).
> 4. `spine-flux-phase2.css` — CSS Phase 2 (kerangka `.fx-spine`/`.fx-block`).
> **Penanda asal di seluruh dokumen:** `[CSS-1]` = ada di `spine-flux.css` · `[CSS-2]` = ada di `spine-flux-phase2.css` · `[SPEC-C]` = hanya disebut di Blueprint Chat (dengan nomor Phase) · `[SPEC-R]` = hanya disebut di Blueprint Rekonstruksi (dengan nomor Bagian/Phase R) · `[KONTEKS]` = konteks tetap project flux-webui · `[PROPOSAL]` = usulan penulis draft, BUKAN desain yang sudah ditetapkan.
> **Prinsip desain yang mengikat** (Blueprint Chat, pembuka): (1) liar di rangka, disiplin di isi — kode & log tetap persegi, monospace, rata kiri; yang ekspresif hanya rangkanya; (2) satu tulang, semua blok menempel padanya — tidak ada kartu melayang bebas; (3) bentuk = makna — Thought = simpul lingkaran, Explored = simpul mata, Edit = simpul berlian, Error = retakan, Selesai = segel cincin penuh; (4) animasi hanya `transform` dan `opacity`; (5) scroll panjang selalu internal — log, diff, dan timeline tidak pernah memperpanjang halaman chat.

---

## 0. Keputusan Finalisasi Muse (MENGIKAT)

Bagian ini memutuskan Pertanyaan Terbuka Bagian 6 yang bersifat desain. Penanda asal untuk nama/aturan dari bagian ini: `[KEPUTUSAN]`. Bila isi Bagian 0 bertentangan dengan bagian lain dokumen ini, **Bagian 0 yang berlaku**.

1. **Daftar sesi (#1)** — ⚠️ **TERGANTIKAN oleh Bagian 7 (Revisi Panel Sesi, DITERIMA Erix 2026-11-17 malam): bar sesi tipis + daftar kartu. Teks keputusan laci di bawah ini historis, jangan diimplementasikan.** Laci geser dari kiri di atas kolom chat, memakai token Bagian 1 (bukan bagian tulang; tulang hanya untuk percakapan). Class baru `[KEPUTUSAN]`: `.fx-drawer` (panel + overlay redup), `.fx-session-row` (satu sesi: judul, waktu relatif, `location.directory`, label model), `.fx-session-row[data-active="true"]` (garis kiri cyan + latar surface), `.fx-new-session` (tombol "Sesi Baru" di kepala laci). Laci dibuka dari satu tombol bulat melayang di pojok kiri atas kolom — `.fx-corner-btn` `[KEPUTUSAN]`, ikon Lucide `Layers` — yang juga membawa titik status koneksi SSE (hijau online / merah offline). Ini BUKAN header strip; kolom tetap penuh. Memilih sesi menutup laci dan mengganti seluruh isi `.fx-spine`.
2. **Pemetaan event (#2)** — Pekerjaan discovery N4 (lihat prompt N4): sensus tipe envelope nyata + pemetaan ke kind dibangun dari bukti. Prinsip penahan risiko: render blok TIDAK bergantung pada menebak semua tipe event — event hanya pemicu refetch REST ter-debounce (300/400ms) dan penanda liveness; satu-satunya tipe yang wajib pasti namanya dari bukti adalah pemicu permission dan penanda busy/idle sesi.
3. **Permission (#3)** — ⚠️ **DIPERLUAS oleh Bagian 8 (popup auto + tiga tombol termasuk Always allow, DITERIMA Erix 2026-11-17 23:58 WIB)** — anatomi kartu di bawah ini tetap berlaku sebagai catatan permanen di tulang; lapisan permukaan dan pilihan ketiganya diatur Bagian 8. Kind baru `permission` `[KEPUTUSAN]`. Anatomi: node amber berdenyut (`.is-live`) selama menunggu; kartu `.fx-permission`: header mono amber `IZIN DIMINTA`, nama tool + ringkasan input (mono, bisa diperluas), dua tombol di `.fx-permission-actions`: `IZINKAN` (garis hijau) / `TOLAK` (garis merah) yang memanggil endpoint reply permission upstream. Sesudah dijawab, kartu menyusut menjadi satu baris hasil (`✓ Diizinkan — <tool>` hijau / `✗ Ditolak — <tool>` merah) dan node berhenti berdenyut. Keadaan kedaluwarsa/tidak dikenal ditampilkan apa adanya dari data — jangan dikarang.
4. **Lubang kind (#4)** — (a) Node `diff`: **hijau**. Node `summary`: **cincin segel hijau** — SVG cincin + centang menggantikan lingkaran `::before` (prinsip "Selesai = segel cincin penuh" berlaku harfiah). (b) `research`: tidak ada anatomi sendiri di N4 — dirender sebagai slab gaya `log` (node violet, judul dari data). (c) Segel verifikasi BUKAN kind sendiri: cincin-cincin check tinggal di seksi VERIFIKASI blok `summary`, satu `.fx-seal` `[KEPUTUSAN]` per check; mengklik cincin yang gagal men-scroll ke blok error terkait.
5. **Simpul mata Explored (#5)** — Simpul mata MENANG (prinsip bentuk = makna + video patokan). Node `::before` untuk `[data-kind="code"]` dinonaktifkan; simpul mata adalah SVG inline `.fx-eye-knot` `[KEPUTUSAN]` yang diposisikan persis di `--fx-spine-x` pada tinggi header blok (pola yang sama dengan simpul Thought): elips hijau + titik tengah, berdenyut halus saat `live`.
6. **Konflik antar blueprint (#6)** — Blueprint Chat menang di wilayah chat: (a) ruas abu = `.fx-attempt-collapsed` (opacity .55, saturate(.3), mono 11,5px); nama `.fx-attempt` TIDAK dipakai. (b) `.fx-edit-old { color:#f8a5a5; text-decoration: line-through; text-decoration-color: var(--fx-red) }`; `.fx-edit-new { background: rgba(74,222,128,.16); color:#aef5c3 }`.
7. **Penamaan elemen tanpa class (#7)** — Resmi `[KEPUTUSAN]`: pill = `.fx-jump-latest`; chip berhenti = `.fx-stopped-chip`; badge = `.fx-edited-badge`; baris fallback hijau blok limit = `.fx-fallback-line`; cincin segel = `.fx-seal` (lihat #4c).
8. **Blok Akses (#8)** — Gerbang hidup di scope token yang sama: akar `.fx-gate` mewarisi semua token `.fx-col`. Class `[KEPUTUSAN]`: `.fx-gate-rail` (garis tulang vertikal gerbang + node cyan di titik kartu), `.fx-gate-card` (kartu form, menggantung lewat konektor horizontal dari node), `.fx-gate-meter` dengan segmen `.fx-gate-seg` (terisi = cyan), `.fx-gate-sub` (sub-node kecil untuk kolom ULANGI PASSWORD), `.fx-chain` (footer RANTAI SISTEM) + `.fx-chain-node`. Perilaku auth persis N2.5; yang diganti hanya kulitnya.
9. **`--fx-progress` (#9)** — Progres sesi = proporsi blok SELESAI dalam run aktif: blok berstatus `done` / total blok run itu × 100%; 0% saat blok `user` lahir, 100% saat `summary` mendarat. Dihitung klien dari `FluxBlock[]`; saat tidak ada run aktif, tampilkan keadaan akhir run terakhir. Sifatnya seremonial-informatif, bukan data upstream.
10. **Limit & fallback (#10)** — Anatomi Bagian 3.8 dibangun apa adanya, tetapi blok `limit` hanya dirender bila data nyata memicunya; keberadaan sinyalnya dibuktikan di discovery N4. Pergantian model fallback adalah perilaku upstream — UI hanya mencerminkan perubahan field model sesi dari REST. Di TEST A status blok ini `SIMULATED`, kecuali limit sungguhan terjadi.
11. **Payload per kind (#11)** — Bentuk payload diturunkan dari data REST nyata pada discovery (#13) dan WAJIB ditipkan di kode (`PayloadPerKind`); `any` longgar dilarang. Minimum per kind mengikuti anatomi Bagian 3 (mis. `log`: array baris terklasifikasi; `diff`: baris +/− dan hitungannya; `summary`: seksi-seksi Bagian 3.10).
12. **Baris Dihapus di ringkasan (#12)** — IKUT sejak N4: struktur ringkasan memuat baris `DIHAPUS` (path + jumlah + status backup) hanya bila sesi itu memang menghapus sesuatu; selain itu barisnya tidak tampil.
13. **Isi `content` assistant (#13)** — Discovery pertama N4, sebelum renderer ditulis (lihat prompt N4). Apa pun hasilnya, mapper wajib toleran: string → blok `stream`; array/object berisi bagian-bagian → petakan per tipe bagian; bentuk tak dikenal → JANGAN dibuang: tampilkan sebagai blok `log` mentah berjudul `content:<tipe>` dan catat di laporan discovery.
14. **Dua makna revert (#14)** — Alur video adalah UX-nya; mekanisme upstream adalah mesinnya: STOP = POST interrupt. Masuk mode edit = POST `/revert/stage` pada pesan user terakhir (menandai percobaan itu sebagai yang akan digantikan). KIRIM ULANG = prompt hasil edit dikirim sebagai pesan baru (blok `user` baru berbadge `diedit`) lalu POST `/revert/commit` — percobaan lama menjadi ruas abu `reverted`. BATAL = POST `/revert/clear`, composer pulih, tidak ada ruas abu. Tombol REVERT di dalam `.fx-edit-bar` tetap berarti memulihkan TEKS asli (makna blueprint) — murni urusan teks composer, bukan endpoint. Semantik stage/clear/commit wajib dibuktikan dulu pada sesi sekali-pakai saat discovery; bila staging gagal/tidak tersedia, alur degrade dengan jujur: edit + kirim ulang tetap jalan sebagai prompt baru biasa, ruas abu hanya visual, dan laporan menyebutkannya.
15. **Label model & konteks (#15)** — Label model dari field `model` sesi. Persen konteks = total token sesi (field `tokens`) ÷ batas konteks model; sumber batasnya dicari di discovery (data config/provider). Bila batas tidak bisa ditentukan: composer menampilkan jumlah token apa adanya dan lapisan cairan `--ctx` disembunyikan — dilarang mengarang persen.
16. **Responsif (#16)** — Token geometri tetap apa adanya di semua lebar (`--fx-spine-x: 40px`, `--fx-node: 14px`); tidak ada aturan skala di N4. Lantai uji: 360px.
17. **Paginasi (#17)** — Muat awal: 50 pesan terakhir (klien selalu mengirim order/limit/cursor eksplisit; urutan tampil menaik). Pesan lebih lama dimuat per halaman 50 lewat cursor saat user menekan chip `.fx-load-older` `[KEPUTUSAN]` ("Muat lebih lama") di puncak tulang atau scroll menyentuh puncak; posisi scroll dipertahankan saat prepend. `.fx-flow` hanya mengukur run aktif; tidak terpengaruh paginasi.

---

## 1. Tabel Token

Semua token tinggal di `.fx-col` `[CSS-1]`, kecuali yang dicatat lain. Nilai dikutip persis.

### 1.1 Warna permukaan & teks

| Token | Nilai | Peran |
|---|---|---|
| `--fx-bg` | `#09090b` | Latar kolom; juga isi node (`background` node = warna ini) |
| `--fx-surface` | `#121214` | Permukaan slab/baris (mis. `.fx-cmd-row`, `.fx-sheet`) |
| `--fx-surface-2` | `#17171a` | Permukaan composer kapsul |
| `--fx-border` | `rgba(255,255,255,.07)` | Border standar slab & panel |
| `--fx-text` | `#f4f4f5` | Teks utama |
| `--fx-muted` | `#a1a1aa` | Teks sekunder |
| `--fx-faint` | `#63636b` | Teks/state paling redup; warna node default `.fx-block::before` |

### 1.2 Warna per data-kind (aksen tulang)

| Token | Nilai | data-kind / makna (komentar di CSS) |
|---|---|---|
| `--fx-cyan` | `#7dd3fc` | streaming, commands, user |
| `--fx-violet` | `#c4b5fd` | riset (research), log |
| `--fx-green` | `#4ade80` | sukses, explored, pass |
| `--fx-red` | `#f87171` | error, stop, hapus |
| `--fx-amber` | `#fbbf24` | thought, warning, limit |

### 1.3 Geometri tulang & bentuk

| Token | Nilai | Peran |
|---|---|---|
| `--fx-spine-x` | `40px` | Posisi tulang dari tepi kiri kolom |
| `--fx-node` | `14px` | Diameter node standar |
| `--fx-radius` | `16px` | Radius standar (slab, kartu limit) |
| (turunan, bukan token) | padding `.fx-spine`: `12px 12px 20px calc(var(--fx-spine-x) + 28px)`; badan tulang lebar `2px`, warna `rgba(255,255,255,.10)`; node di `top: 6px`, `border: 2px solid`; jarak antar blok `margin-bottom: 14px` | `[CSS-2]` |

### 1.4 Gerak

| Token | Nilai | Peran |
|---|---|---|
| `--fx-ease` | `cubic-bezier(.2,.8,.2,1)` | Easing standar semua transisi |
| `--fx-dur` | `280ms` | Durasi animasi standar (toggle) |
| `--fx-dur-slow` | `600ms` | Segel cincin, orbit masuk; juga transisi `.fx-flow` (`height .6s`) |

Aturan gerak global: `@media (prefers-reduced-motion: reduce)` mematikan semua animasi & transisi di dalam `.fx-col` `[CSS-1]`. Tabel animasi lengkap ada di Lampiran B Blueprint Chat (toggle Thought 280ms; denyut simpul live 1,6s loop; kursor streaming kedip 1s `steps(1)`; spinner command 0,9s linear; helix diff `stroke-dashoffset` 600ms; segel cincin 600ms; cincin countdown limit 1s/detik linear; cairan konteks 800ms; toast & sheet 280ms; `.fx-flow` 600ms).

### 1.5 Token syntax (slab kode)

| Token | Nilai |
|---|---|
| `--tok-keyword` | `#c4b5fd` |
| `--tok-func` | `#7dd3fc` |
| `--tok-string` | `#a6f3be` |
| `--tok-type` | `#fbbf24` |
| `--tok-tag` | `#f87171` |
| `--tok-comment` | `#6e7681` |

### 1.6 Variabel runtime (diisi dari JS, bukan konstanta desain)

| Variabel | Diisi oleh | Makna |
|---|---|---|
| `--fx-progress` | JS pada `.fx-flow` (`height: var(--fx-progress, 0%)`) | Progres sesi 0–100% — definisi "progres sesi" untuk flux-webui belum ditetapkan sumber (lihat Pertanyaan Terbuka #9) |
| `--fx-knot-scale` | Inline style dari komponen Thought (`0.7 + min(log10(dur+1), 0.6)`) | Skala simpul Thought ∝ log durasi `[SPEC-C Phase 4.3]` |
| `--ctx` | JS pada `.fx-composer::after` (`width: var(--ctx, 20%)`) | Persen konteks sesi untuk cairan composer `[SPEC-C Phase 9]` |

### 1.7 Token di luar lingkup N4 (dicatat agar tidak hilang)

| Token | Nilai | Lingkup |
|---|---|---|
| `--fx-explorer-w` | `40%` (di `:root`, diubah `.fx-divider` saat diseret) | N5 `[SPEC-R R2]` |
| `--fx-beam-dur` | `900ms` | N5 (berkas Auto Follow) `[SPEC-R R2]` |

### 1.8 Nilai literal yang muncul di template blueprint (belum jadi token)

Nilai-nilai ini tertulis apa adanya di template CSS blueprint — implementer N4 memakai persis nilai ini, atau Muse memutuskan menokenkannya saat finalisasi:

- Node live: `box-shadow: 0 0 0 5px rgba(125,211,252,.15)` pada `.fx-block.is-live::before` `[CSS-2]`.
- Garis baris aktif slab kode: `.fx-line-active { background: rgba(125,211,252,.10) }`, konektor `background: var(--fx-cyan)` `[SPEC-C Phase 5.1]`.
- Kartu limit: `border: 1px solid rgba(251,191,36,.45); background: rgba(251,191,36,.06)` `[SPEC-C Phase 6.2]`.
- Cairan konteks composer: normal `rgba(56,150,190,.28)`; konteks >90% `rgba(180,83,9,.35)` `[SPEC-C Phase 9]`.
- Toast sukses: `background: rgba(22,46,30,.95)`, border `rgba(74,222,128,.5)` `[SPEC-C Phase 8.3]`.
- Tombol salin berhasil: `.fx-copy-btn.is-copied { color: var(--fx-green); border-color: rgba(74,222,128,.5) }` `[SPEC-C Phase 8.3]`.
- Edit: `.fx-edit-old` / `.fx-edit-new` — **dua versi berbeda antar blueprint** (lihat Pertanyaan Terbuka #6).
- Composer mode edit: `border: 1px solid rgba(251,191,36,.55); background: #181207` `[SPEC-R 5.5]`.
- Tipografi dasar kolom: `font-size: 14px; line-height: 1.6` pada `.fx-col` `[CSS-1]`; baris command & baris tree: `font-family: ui-monospace, Menlo, monospace; font-size: 12.5px` `[SPEC-C Phase 5.2]`.

---

## 2. Katalog Class `.fx-*`

Setiap class yang ada di dua file CSS atau disebut di kedua blueprint. Class N5 (Work Explorer) tetap dicatat demi kelengkapan katalog, ditandai lingkupnya.

### 2.1 Kerangka kolom & tulang

| Class / pola | Asal | Tanggung jawab (satu baris) |
|---|---|---|
| `.fx-col` | `[CSS-1]` | Akar kolom chat: pemegang semua token `--fx-*`/`--tok-*`, `height: 100dvh`, flex column, `padding-bottom: env(safe-area-inset-bottom)` |
| `.fx-scroll` | `[CSS-2]` | Satu-satunya scroller global kolom chat (`overflow-y: auto`, `overscroll-behavior: contain`, smooth) |
| `.fx-spine` | `[CSS-2]` | Rel tulang: kontainer relatif ber-padding kiri `calc(var(--fx-spine-x) + 28px)`; `::before` = badan tulang 2px |
| `.fx-flow` | `[CSS-2]` | Cahaya progres yang mengalir turun di tulang; tinggi dari `--fx-progress`; gradasi cyan→violet→amber |
| `.fx-block` | `[CSS-2]` | Blok pesan generik; `::before` = node standar di tulang (lingkaran, border `--fx-faint`) |
| `.fx-block.is-live` | `[CSS-2]` | Keadaan blok aktif/streaming: glow cincin pada node |

### 2.2 Node per data-kind (semua `[CSS-2]`, pola `.fx-block[data-kind="…"]::before`)

| Pola | Warna node | Catatan bentuk |
|---|---|---|
| `[data-kind="thought"]` | `--fx-amber` | Lingkaran standar |
| `[data-kind="code"]` | `--fx-green` | Lingkaran standar (tetapi lihat Pertanyaan Terbuka #5 soal simpul mata) |
| `[data-kind="command"]` | `--fx-cyan` | Lingkaran standar |
| `[data-kind="log"]` | `--fx-violet` | Lingkaran standar |
| `[data-kind="error"]` | `--fx-red` | **Kotak** (`border-radius: 3px`) — retak = kotak |

Warna node untuk kind lain ditetapkan sumber hanya lewat teks (bukan CSS): `user` = cyan `[SPEC-C Phase 4.1 + komentar token]`; `stream` = cyan `[komentar token CSS-1]`; `limit` = amber `[komentar token CSS-1]`; `research` = violet `[komentar token CSS-1]`; `delete` = merah `[SPEC-R 5.4]`. Kind `diff` dan `summary` **tidak** punya warna node di sumber mana pun (Pertanyaan Terbuka #4).

### 2.3 Blok Thought

| Class / pola | Asal | Tanggung jawab |
|---|---|---|
| `.fx-thought` | `[SPEC-C Phase 4.3]` | Varian blok Thought (membawa state `.is-open` / `.is-live`) |
| `.fx-knot` | `[SPEC-C Phase 4.3]` | Tombol simpul Thought: SVG lingkaran + label `Thought · {dur}s`; target toggle buka/tutup |
| `.fx-knot-svg` | `[SPEC-C Phase 4.3]` | SVG simpul: lingkaran `stroke` amber; berputar 90° saat `.is-open`; berdenyut (`fx-breathe`) saat live |
| `.fx-thought-body` | `[SPEC-C Phase 4.3]` | Badan Thought yang terurai: toggle via `grid-template-rows: 0fr → 1fr` (tanpa animasi height) |

### 2.4 Blok kerja (streaming, kode, command, log)

| Class / pola | Asal | Tanggung jawab |
|---|---|---|
| `.fx-stream-cursor` | `[SPEC-C Phase 4.2]` | Kursor blok di ujung teks streaming (8px, cyan, kedip `fx-blink` 1s) |
| `.fx-line-active` | `[SPEC-C Phase 5.1]` | Baris kode yang sedang dibaca agent di slab Explored + garis penghubung 26px ke tulang |
| `.fx-cmd-row` | `[SPEC-C Phase 5.2]` | Satu baris antrean perintah: min-height 44px, mono 12,5px, bg `--fx-surface`, radius 12px |
| `.fx-cmd-row[data-status="…"]` | `[SPEC-C Phase 5.2]` | Pewarnaan state baris command (`live`/`done`/`error`) lewat `.fx-cmd-state` |
| `.fx-cmd-state` | `[SPEC-C Phase 5.2]` | Label state di kanan baris command (spinner/durasi/error) |
| `.fx-spin` | `[SPEC-C Phase 5.2]` | Animasi putar ikon loader (`fx-rot` 0,9s linear) untuk command live |

### 2.5 Blok gangguan (error, limit, edit)

| Class / pola | Asal | Tanggung jawab |
|---|---|---|
| `.fx-limit` | `[SPEC-C Phase 6.2]` | Kartu banner limit model (border & bg amber transparan, radius `--fx-radius`, padding 12px) |
| `.fx-limit-ring` | `[SPEC-C Phase 6.2]` | Cincin hitung mundur retry (SVG arc amber, dashoffset 1s linear) |
| `.fx-edit-old` | `[SPEC-C Phase 6.3]` + `[SPEC-R 5.4/5.5]` | Potongan prompt lama saat mode edit: teks merah + coret |
| `.fx-edit-new` | `[SPEC-C Phase 6.3]` + `[SPEC-R 5.4/5.5]` | Potongan prompt baru saat mode edit: teks/highlight hijau |
| `.fx-attempt-collapsed` | `[SPEC-C Phase 6.3]` | Ruas abu percobaan lama (opacity .55, saturasi .3, mono 11,5px) — nama versi Blueprint Chat |
| `.fx-attempt` | `[SPEC-R 5.4/5.5]` | Ruas abu yang sama — nama versi Blueprint Rekonstruksi (opacity .45, saturasi .2, node dipaksa `--fx-faint`). Konflik nama: Pertanyaan Terbuka #6 |

### 2.6 Blok penutup & copy

| Class / pola | Asal | Tanggung jawab |
|---|---|---|
| `.fx-helix` | `[SPEC-C Phase 7.1]` | SVG header diff: dua gelombang sinus berlawanan fase (hijau/merah), animasi gambar 600ms |
| `.fx-copy-btn` | `[SPEC-C Phase 8.3]` | Tombol/ikon salin (ringkasan, per bagian, header slab log & diff) |
| `.fx-copy-btn.is-copied` | `[SPEC-C Phase 8.3]` | State berhasil salin: hijau selama ±2 detik (`✓ Tersalin`) |
| `.fx-toast` | `[SPEC-C Phase 8.3]` | Toast konfirmasi salin (sticky top, pil hijau, animasi `fx-toast-in`) |
| `.fx-sheet` | `[SPEC-C Phase 8.3]` | Lembar preview clipboard dari bawah (animasi `fx-sheet-in`) |

### 2.7 Composer

| Class / pola | Asal | Tanggung jawab |
|---|---|---|
| `.fx-composer` | `[SPEC-C Phase 2/9]` | Composer kapsul (radius 20px, bg `--fx-surface-2`); `::after` = cairan konteks selebar `--ctx` |
| `.fx-composer[data-ctx-high="true"]` | `[SPEC-C Phase 9]` | Keadaan konteks >90%: cairan berubah oranye |
| `.fx-composer.is-editing` | `[SPEC-R 5.4/5.5]` | Mode edit setelah revert: bingkai amber + bg `#181207` |
| `.fx-edit-bar` | `[SPEC-R 5.4]` (disebut juga di alur `[SPEC-C Phase 6.3]`) | Toolbar edit di dalam composer: REVERT / BATAL / KIRIM ULANG |
| `.fx-stop` | `[SPEC-R 5.4]` | Tombol STOP merah saat agent bekerja (di composer; padanan perilaku tombol `■` Phase 9 Blueprint Chat) |

### 2.8 Kerangka aplikasi & Work Explorer — lingkup N5 (dicatat, bukan dibangun di N4)

| Class / pola | Asal | Tanggung jawab |
|---|---|---|
| `.fx-shell` | `[SPEC-R 5.2/5.5]` | Pembungkus tertinggi: grid dua kolom (chat + sekat) |
| `.fx-shell.is-explorer-hidden` | `[SPEC-R 5.5]` | Sekat dilipat segitiga → chat 100% penuh |
| `.fx-divider` | `[SPEC-R 5.2/5.5]` | Pembagi vertikal antar kolom; pegangan seret + tempat segitiga |
| `.fx-explorer` | `[SPEC-R 5.2/5.5]` | Sekat kanan (lebar `--fx-explorer-w`) |
| `.fx-detect-strip` | `[SPEC-R 5.2/5.5]` | Panel 1: strip "DETEKSI PROJECTS" |
| `.fx-detect-card` | `[SPEC-R 5.2]` | Card project di halaman Global Project Detection |
| `.fx-nav` | `[SPEC-R 5.2/5.5]` | Panel 2: Global Navigation terkunci (tidak ikut scroll, tidak membawa state navigasi sendiri) |
| `.fx-nav-home` | `[SPEC-R 5.2]` | Tombol Root Home di dalam `.fx-nav` |
| `.fx-eye` + `[data-on="true"/"false"]` | `[SPEC-R 5.2/5.5]` | Toggle mata Auto Follow; hijau saat ON, `--fx-faint` saat OFF |
| `.fx-search` | `[SPEC-R 5.2]` | Input Search Path global di dalam `.fx-nav` |
| `.fx-triangle` | `[SPEC-R 5.2]` | Wadah penanda animasi segitiga existing 1,5 dtk (hanya membungkus, tidak mengganti animasi) |
| `.fx-tree` | `[SPEC-R 5.2/5.5]` | Kontainer Home/Project Root Tree (scroller internal) |
| `.fx-row` | `[SPEC-R 5.2/5.5]` | Satu baris folder/file di tree (mono 12,5px) |
| `.fx-row[data-state="read"/"write"/"error"/"deleting"/"target"]` | `[SPEC-R 5.3/5.5]` | State baris tree: cyan dibaca, amber ditulis, merah error, merah+coret dihapus, latar sorot target follow |
| `.fx-tools` | `[SPEC-R 5.2]` | Baris chip tools cepat di dasar sekat (Editor / Terminal / Preview) |
| `.fx-beam` | `[SPEC-R 5.3/5.5]` | SVG overlay berkas cahaya antar panel (`pointer-events: none`) |
| `.fx-beam-path` | `[SPEC-R 5.3/5.5]` | Path kurva berkas (dash 6 8, cyan; amber saat `.fx-beam.is-retarget`) |
| `.fx-beam-pulse` | `[SPEC-R 5.3]` | Lingkaran denyut yang berjalan di sepanjang berkas |
| `.fx-retarget-note` | `[SPEC-R 5.3]` | Catatan kecil retarget ("target baru: ⌂ Home (induk terdekat)") |

### 2.9 Keyframes (semua `[SPEC-C]`, kecuali yang dicatat)

| Nama | Dipakai oleh | Gerakan |
|---|---|---|
| `fx-blink` | `.fx-stream-cursor` | opacity kedip, 1s `steps(1)` |
| `fx-breathe` | `.fx-thought.is-live .fx-knot-svg` | `scale` 1→1,12, 1,6s ease-in-out loop |
| `fx-rot` | `.fx-spin` | `rotate` 360°, 0,9s linear loop |
| `fx-toast-in` | `.fx-toast` | `translateY(-8px)` + opacity masuk, `--fx-dur` |
| `fx-sheet-in` | `.fx-sheet` | `translateY(16px)` + opacity masuk, `--fx-dur` |

### 2.10 Elemen bernama tanpa class di sumber

Elemen-elemen ini disebut blueprint sebagai perilaku, tetapi **tidak diberi nama class**: pill `↓ Jump to latest` (stream & log), chip status `■ Dihentikan oleh kamu`, badge `diedit` pada blok user, cincin segel verifikasi Phase 7.2, baris fallback hijau pada blok limit. Nama resminya SUDAH diputuskan Muse — lihat Keputusan Finalisasi #7 di Bagian 0.

---

## 3. Anatomi Blok per Data-Kind

### 3.0 Model data di balik blok (warisan Blueprint Chat Phase 3)

UI dirender murni dari array blok bertipe — bukan menebak dari teks `[SPEC-C Phase 3]`:

- `FluxKind` = `'user' | 'stream' | 'thought' | 'code' | 'command' | 'log' | 'error' | 'diff' | 'limit' | 'research' | 'summary'`. Blueprint Rekonstruksi menambahkan satu kind tekstual: `'delete'` `[SPEC-R 5.4]`.
- `FluxStatus` = `'queued' | 'live' | 'done' | 'error' | 'stopped' | 'reverted'`.
- `FluxBlock` = `{ id, kind, status, startedAt, endedAt?, title, payload }` — `title` adalah label pendek di samping node; `payload` isi spesifik per kind (hanya payload `command` yang diberi tipe konkret di sumber: `CommandItem { cmd, status, durationMs? }`; payload kind lain belum ditipkan — Pertanyaan Terbuka #11).
- Mesin status yang sah: `queued → live → done`; `live → error → (blok fix) → live → done`; `live --[user stop]--> stopped --[revert]--> ruas abu 'reverted'`; limit: `live → error(limit) → live` (fallback, stream **dilanjutkan**, bukan diulang).
- **Peringatan adaptasi:** tabel pemetaan event di Blueprint Chat Phase 3 memakai nama event project lama (`message.user`, `text.delta`, `thinking.start/.delta/.end`, `tool.read`, `tool.command.*`, `tool.edit`, `provider.error`, `message.stop`, `session.done`) dan blueprint sendiri memerintahkan "sesuaikan nama event dengan adapter kamu". Di flux-webui, SSE adalah aliran global dan frontend memilah dari field `type` + `data.sessionID` pada envelope; event adalah sinyal, kebenaran diambil dari REST (refetch ter-debounce) `[KONTEKS]`. Pemetaan nama event nyata flux-webui → kind adalah pekerjaan discovery N4 (Pertanyaan Terbuka #2).

### 3.1 `user` — Prompt pengguna `[SPEC-C Phase 4.1]`

- **Node:** cyan (teks sumber; belum ada aturan CSS khusus).
- **Anatomi:** tanpa bubble besar — label kecil `YOU` + teks 14px, menempel langsung di tulang.
- **State:** lahir langsung `done`. Prompt yang pernah diedit & dikirim ulang membawa badge kecil `diedit` (hijau; class belum bernama — Bagian 2.10).
- **Collapse:** tidak ada.

### 3.2 `stream` — Streaming teks asisten `[SPEC-C Phase 4.2]`

- **Node:** cyan (komentar token).
- **Perilaku badan:** teks datang per delta dan **ditambahkan ke blok yang sama** — dilarang membuat blok baru per token. Selama `live`, ujung teks membawa `.fx-stream-cursor` yang berkedip.
- **Performa:** delta di-buffer dan dirender maksimal 1× per frame (`requestAnimationFrame`), bukan per token.
- **Scroll:** selama user scroll ke atas membaca, kolom **tidak** dipaksa turun; tampilkan pill `↓ Jump to latest` (aturan sama dengan log, Bagian 3.6).
- **Live vs selesai:** `live` → kursor berkedip + node `.is-live`; `done` saat event akhir stream — kursor hilang.

### 3.3 `thought` — Thought / reasoning, "Simpul Napas" `[SPEC-C Phase 4.3]`

- **Node/bentuk:** simpul lingkaran SVG amber (`.fx-knot-svg`) menggantikan kesan node biasa; bentuk = makna (simpul = berpikir).
- **Ukuran ∝ durasi:** skala `--fx-knot-scale = 0.7 + min(log10(dur+1), 0.6)`; durasi > 30 dtk → lingkaran **dobel** (r=13 + r=7), selain itu tunggal (r=10). Contoh acuan sumber: Thought 1,5 dtk simpulnya kecil; Thought 59,4 dtk dobel & besar.
- **Header:** tombol `.fx-knot` berisi SVG + label `Thought · {dur}s` (durasi berjalan saat live, final saat done), `aria-expanded` mengikuti state.
- **Collapse/expand:** tertutup = tulang melingkar jadi simpul; terbuka = simpul terurai — isi mengalir di "anak sungai" (garis cabang sejajar tulang) lalu menyatu lagi; SVG berputar 90°; badan dibuka via `grid-template-rows 0fr→1fr` selama `--fx-dur` (280ms). Satu class `.is-open` mengendalikan toggle.
- **Live:** simpul berdenyut (`fx-breathe`, scale ke 1,12, 1,6s) selama status `live` (`.fx-thought.is-live`).

### 3.4 `code` — Explored / baca kode `[SPEC-C Phase 5.1]`

- **Node:** hijau `[CSS-2]`. Blueprint teks menyebut node berbentuk **simpul mata** (SVG elips horizontal + titik) — berbeda dari lingkaran CSS Phase 2; konflik ini dicatat di Pertanyaan Terbuka #5.
- **Header:** nama file yang dibaca (dari `title` blok).
- **Badan:** slab `<pre>` disiplin — monospace, gutter nomor baris, highlight memakai token `--tok-*` (Bagian 1.5). **Scroll internal:** `max-height: 46dvh; overflow: auto; overscroll-behavior: contain`.
- **Baris aktif:** baris yang sedang dibaca membawa `.fx-line-active` + garis penghubung 26px dari baris ke tulang.
- **Multi-file:** file lain yang ikut terbaca tampil sebagai tumpukan slab yang mengintip di belakang (offset 6px per lapis); fungsi yang dilipat menjadi chip peta simbol `namaFungsi · baris awal–akhir`.
- **Live vs selesai:** `live` selama pembacaan (baris aktif bergerak), `done` saat selesai.

### 3.5 `command` — Antrean perintah `[SPEC-C Phase 5.2]`

- **Node:** cyan `[CSS-2]`.
- **Anatomi:** satu blok per sesi tool; isinya **baris antrean** `.fx-cmd-row`, bukan kartu terpisah. Urutan visual selalu: antre (`·`) → berjalan (spinner `.fx-spin`) → `✓ durasi` / `✗ error`. Perintah berikutnya tidak mulai sebelum yang di atasnya selesai (sesuai eksekusi asli).
- **State baris:** `.fx-cmd-state` di kanan: `live` = cyan + spinner; `done` = hijau + durasi (acuan sumber: build 6,4s); `error` = merah.
- **Collapse:** tidak diatur sumber; blok tumbuh mengikuti jumlah baris antrean.

### 3.6 `log` — Log panjang `[SPEC-C Phase 5.3]`

- **Node:** violet `[CSS-2]`.
- **Header slab:** judul `Log — nama perintah`, penghitung baris, tombol salin log (Bagian 3.10).
- **Badan — aturan keras:**
  1. Selalu di dalam slab scroll internal `max-height: 40dvh` — log 32 baris atau 3.000 baris, tinggi slab sama; halaman chat tidak pernah memanjang karenanya.
  2. Auto-scroll ke bawah **hanya** bila user sedang di dekat bawah (ambang: sisa scroll < 40px). Bila user scroll ke atas → pill `↓ Jump to latest` + penghitung `baris X/Y`.
  3. Klasifikasi baris saat masuk: `info` = muted, `warn` = amber, `error` = merah, `success` = hijau, `cmd` = putih diawali `$`.
  4. Virtualisasi ringan: semua baris disimpan di memori, yang dirender ke DOM hanya ±120 baris terakhir; salin log tetap mengambil dari data utuh.
- **Live vs selesai:** baris mengalir masuk selama command berjalan; header penghitung bertambah.

### 3.7 `error` — Tulang retak `[SPEC-C Phase 6.1]`

- **Node:** merah dan **kotak** `[CSS-2]`.
- **Tulang:** di titik blok error, garis tulang digambar **zigzag merah** (SVG polyline kecil menggantikan garis lurus di segmen itu).
- **Badan slab:** border merah tipis; baris pertama = lokasi `file:baris:kolom`; baris kode error (mis. `TS2345: …`); baris ringkasan bentuk `✗ Build failed — 1 error, 3 warnings`.
- **Wajib berpasangan:** di bawahnya selalu ada blok penjelasan asisten (penyebab + rencana perbaikan) sebagai blok `stream` biasa — error tidak pernah tampil telanjang.
- **Sesudah perbaikan:** blok `diff` + `command` ulangan muncul di bawahnya, ditutup segel verifikasi (Bagian 3.9). Tulang di atas titik error **tetap retak** sebagai jejak sejarah; segmen baru lurus lagi.

### 3.8 `limit` — Limit model `[SPEC-C Phase 6.2]`

Urutan tampil selalu seperti ini (sesuai video referensi lama di Blueprint Chat):

1. Stream yang berjalan **berhenti di tengah kalimat** — kursor berubah merah & berhenti berkedip setelah 1 detik.
2. Kartu `.fx-limit` menyela: `⚠ MODEL KENA LIMIT` · `429 · kuota token <model> tercapai` · kalimat penenang "Stream berhenti di tengah kalimat — bukan error kamu."
3. **Cincin hitung mundur** retry `.fx-limit-ring` (arc SVG menyapu, angka detik di tengah).
4. Cairan konteks composer berwarna oranye saat konteks >90% (Bagian 4.5).
5. Saat fallback aktif: baris hijau `✓ Beralih: <model-fallback> via 9Router · konteks dipadatkan 98% → 54%`; label model di composer berganti; **stream dilanjutkan dari kata terakhir di blok `stream` yang sama** (bukan blok baru). Status blok limit: `error → done` setelah fallback.

> Catatan adaptasi: naskah di atas adalah warisan project lama (gateway 9Router adalah konteks project lama). Apakah adapter flux-webui memunculkan sinyal limit/fallback yang setara adalah pertanyaan discovery (Pertanyaan Terbuka #10) — anatomi visualnya dipertahankan apa adanya sampai dibuktikan lain.

### 3.9 `diff` + segel verifikasi `[SPEC-C Phase 7.1–7.2]`

- **`diff` — Header Helix:** isi diff tetap daftar baris biasa (`+` hijau / `−` merah, scroll internal seperti log). Yang khas hanya headernya: `.fx-helix`, satu SVG dua gelombang sinus berlawanan fase (hijau mendekat, merah menjauh) + penghitung bentuk `−182 / +166`. Animasi masuk: kedua path digambar `stroke-dashoffset` 100→0 selama 600ms (`--fx-dur-slow`).
- **Segel verifikasi:** satu cincin SVG per check (acuan sumber: `npm run build`, `npx tsc --noEmit`). Cincin menyapu 0→360° selama proses (600ms). Penuh + `✓ PASS` = hijau. Gagal = cincin **putus di titik proporsional dengan baris error**, merah; mengklik cincin men-scroll ke blok error terkait. Segel tidak punya `FluxKind` sendiri di sumber (Pertanyaan Terbuka #4).

### 3.10 `summary` — Ringkasan selesai + salin `[SPEC-C Phase 7.3 + Phase 8]`

- **Node:** tidak ditetapkan sumber (Pertanyaan Terbuka #4). Prinsip blueprint: "Selesai = segel cincin penuh" (pembuka Blueprint Chat).
- **Struktur tetap** (inilah yang disalin):

```
RINGKASAN RINCIAN
PERUBAHAN         · file & ringkasan edit (+/−)
VERIFIKASI        · build PASS / tsc PASS
BACKUP & ROLLBACK · path .backup + perintah rollback
STATISTIK         · durasi sesi, jumlah fase, token/k konteks, limit yang terjadi
```

- Blueprint Rekonstruksi R9 menambahkan: **baris Dihapus** bila ada penghapusan di sesi itu (path + jumlah file + status backup) `[SPEC-R R9]` — relevansi untuk N4 diputuskan Muse (Pertanyaan Terbuka #12).
- **Setiap bagian:** judul kecil kapital + ikon salin di kanan judul + isi baris `·`.
- **Pola sesi:** satu sesi penuh selalu berakhir dengan pola sama: diff → segel → ringkasan. Tidak ada sesi "menggantung" tanpa ringkasan.
- **Copy dibangun dari data** `FluxBlock[]`, bukan scrape DOM (log 3.000 baris tersalin utuh walau yang dirender 120):
  - Tombol utama di bawah ringkasan: `[ikon salin] Salin Ringkasan Ini`, target sentuh ≥44px.
  - Berhasil: tombol jadi `✓ Tersalin` (hijau, 2 detik) + `.fx-toast` meluncur dari atas: `✓ Ringkasan tersalin ke clipboard`.
  - Preview: `.fx-sheet` naik dari bawah menampilkan 4–5 baris pertama isi salinan + `… (N kata)` + tombol [TEMPEL] [TUTUP] — user bisa memeriksa apa yang disalinnya.
  - Gagal: toast merah `Gagal menyalin — tahan teks untuk menyalin manual` + teks ditampilkan di sheet untuk disalin manual. Tidak boleh gagal diam-diam.
  - Jalur clipboard: `navigator.clipboard.writeText()` → fallback `<textarea>` sementara + `document.execCommand('copy')` `[SPEC-C Phase 8.2]`.

### 3.11 Kind tanpa anatomi lengkap di sumber

- **`research`:** ada di `FluxKind` dan komentar token (violet = riset), tetapi tidak ada bagian anatomi di kedua blueprint (Pertanyaan Terbuka #4).
- **`delete`** `[SPEC-R 5.4]`: node merah di kolom chat untuk blok Hapus; perilaku pasangannya (baris tree bercoret lalu hilang, retarget) adalah wilayah explorer/N5–N8 di Blueprint Rekonstruksi. Anatomi badan bloknya tidak dirinci sumber.
- **Permission ask/reply:** termasuk lingkup N4 `[KONTEKS]`, tetapi **tidak ada kind, class, maupun anatomi** untuknya di kedua blueprint (Pertanyaan Terbuka #3).

---

## 4. Struktur Layout N4

Hierarki dari luar ke dalam. Class yang belum ada di sumber ditandai eksplisit.

### 4.1 Gerbang akses — Blok Akses `[KONTEKS, desain sudah diputuskan & digambar: auth-setup.png / auth-login.png]`

Gerbang membungkus seluruh aplikasi: sebelum sesi login valid, yang tampil hanya Blok Akses; sesudahnya gerbang digantikan shell aplikasi (Bagian 4.2). N4 mengganti kulit gerbang polos warisan N2.5 dengan desain ini; perilaku auth-nya tidak berubah.

Anatomi bersama kedua varian:
- Layar adalah **blok pertama pada tulang yang sama** dengan kolom chat: garis tulang masuk dari atas, berhenti di **node cyan menyala**, dan kartu form menggantung di tulang lewat konektor horizontal — label kartu: `BLOK AKSES · LANGKAH 0`.
- Di bawah layar: footer **RANTAI SISTEM** — tulang mini horizontal berisi tiga node hijau: `ADAPTER 28572 · ENGINE 28570 · 9ROUTER 20128`, datanya langsung dari `/healthz`; tulang vertikal layar turun menyambung ke node pertamanya.

Varian **SETUP** (belum ada password):
- Chip amber `SETUP`; judul kartu "Buat password adapter".
- Kolom `USERNAME — OPSIONAL` (boleh kosong; bila kosong login cukup password).
- Kolom password (keadaan sedang mengetik) + **FLUX METER**: 8 segmen tulang mini yang terisi satu per satu mengikuti jumlah karakter menuju minimum 8, dengan keterangan bentuk `6 dari 8 karakter minimum`.
- Kolom `ULANGI PASSWORD` lebih redup, menggantung di **sub-node** kecil pada tulang.
- Tombol `AKTIFKAN & MASUK`.
- Di bawah kartu: tulang masih redup + node redup "langkah berikutnya — tulang sesi dimulai" (belum ada sesi, belum ada aliran).

Varian **LOGIN** (password sudah diatur):
- Chip `LOGIN`; judul kartu "Masuk".
- Kolom `USERNAME` — **hanya tampil bila username memang diatur** (dari `hasUsername` pada state auth); bila tidak diatur, kartu hanya berisi kolom password.
- Kolom `PASSWORD ADAPTER`.
- Petunjuk amber: `5× salah berturut — terkunci 60 detik` (perilaku lockout nyata adapter).
- Tombol `MASUK`.
- Aliran pada tulang **melewati node dan memudar ke bawah** — sesi menunggu di balik blok; node redup "tulang sesi menunggu di balik blok ini".
- Catatan pemulihan kecil: lupa password → hapus `credentials.json` di state dir → kembali ke mode setup.

> Kesenjangan sumber: **tidak ada class `.fx-*` untuk elemen gerbang di kedua file CSS maupun blueprint** (blueprint lama menaruh auth di luar ruang lingkup). SUDAH DIPUTUSKAN Muse — lihat Keputusan Finalisasi #8 di Bagian 0 (usul penulis draft untuk memakai scope token yang sama DITERIMA, lengkap dengan nama class gerbangnya).

### 4.2 Shell aplikasi (sesudah login)

```
[Blok Akses]  — selama belum login (4.1)
      │ login valid
      ▼
Shell aplikasi
├── Daftar sesi        — lihat catatan di bawah
└── Kolom chat .fx-col (4.3)
    ├── .fx-scroll
    │   └── .fx-spine  (blok-blok sesi aktif)
    └── .fx-composer   (4.5)
```

- Di N4 shell adalah **satu kolom chat penuh** — tidak ada header strip Runtime/localhost di atas kolom (keputusan desain lama yang dipertahankan blueprint: panel penuh) `[SPEC-C Phase 2 checklist]`.
- Kerangka split `.fx-shell` (chat + sekat explorer) adalah **N5** `[SPEC-R 5.2]` — N4 tidak membangunnya; kolom chat N4 harus tetap berfungsi berdiri sendiri di dalam `.fx-col` dan siap dibungkus `.fx-shell` di N5.
- **Daftar sesi:** termasuk lingkup N4 `[KONTEKS]`, tetapi **kedua blueprint tidak merancangnya sama sekali** (ruang lingkup blueprint lama hanya kolom chat; sidebar dinyatakan protected/tidak berubah di project lama). Bentuknya — laci geser, layar tersendiri, atau strip — dan class-nya belum ditetapkan sumber mana pun (Pertanyaan Terbuka #1). Yang sudah pasti dari konteks: daftar berasal dari REST daftar sesi; sesi punya `title`, `time`, dan `location.directory` sebagai workspace-nya; memilih sesi mengganti isi `.fx-spine` ke sesi itu dan SSE di-scope ke `data.sessionID` sesi aktif.

### 4.3 Kolom chat `[CSS-1 + CSS-2]`

Struktur DOM target persis dari blueprint:

```
<div class="fx-col">                 <!-- akar + token, 100dvh -->
  <div class="fx-scroll">            <!-- satu-satunya scroller global -->
    <div class="fx-spine">           <!-- rel tulang -->
      <div class="fx-flow"></div>    <!-- aliran cahaya progres -->
      <section class="fx-block" data-kind="user">…</section>
      <section class="fx-block" data-kind="thought">…</section>
      … blok lain mengikuti urutan sesi …
    </div>
  </div>
  <div class="fx-composer">…</div>   <!-- di luar scroller, nempel di bawah -->
</div>
```

Aturan kolom:
- Setiap blok adalah `<section class="fx-block" data-kind="…">` dengan node `::before` sejajar di `--fx-spine-x`; tidak ada kartu melayang bebas di luar tulang.
- `.fx-flow` menggambar ulang tingginya dari `--fx-progress` setiap fase sesi berganti (transisi 600ms).
- Isi kolom adalah fungsi murni dari data sesi (REST) + sinyal SSE: event datang → refetch ter-debounce → blok diperbarui; pemilahan event per sesi dari `type`/`data.sessionID` envelope `[KONTEKS]`.
- Toast copy `.fx-toast` bersifat `sticky; top: 8px` di dalam kolom; sheet preview `.fx-sheet` menempel di dasar kolom `[SPEC-C Phase 8.3]`.

### 4.4 Urutan blok dalam satu sesi (pola baku)

Mengikuti alur blueprint: `user` → (`thought` / `stream` / `code` / `command` / `log` / `error` / `limit` bergantian mengikuti kerja agent) → `diff` → segel verifikasi → `summary`. Alur gangguan menyela di tempatnya: stop membekukan blok aktif (`stopped`), revert melipat percobaan menjadi ruas abu (`reverted`), limit menyela lalu stream berlanjut di blok yang sama.

### 4.5 Composer `[SPEC-C Phase 9 + SPEC-R 5.4/R7]`

- **Bentuk:** kapsul melayang `border-radius: 20px`, bg `--fx-surface-2`, nempel di bawah kolom di atas `env(safe-area-inset-bottom)`; `overflow: hidden` agar cairan konteks mengikuti bentuk kapsul.
- **Cairan konteks:** lapisan `::after` yang **lebarnya** mengikuti `--ctx` (persen konteks sesi), transisi 800ms; warna normal `rgba(56,150,190,.28)`, `data-ctx-high="true"` (>90%) → `rgba(180,83,9,.35)`.
- **Isi** (di atas cairan, `position: relative; z-index: 1`): area teks auto-grow (maks 5 baris lalu scroll internal; menyusut saat user membaca ke atas), pill model (label model aktif — berganti otomatis saat fallback limit), label `konteks N%`, tombol bulat 40px: `↑` saat idle, `■` merah (`.fx-stop`) saat agent bekerja = tombol STOP.
- **Placeholder mengikuti status:** `Tulis pesan…` (idle) · `Agent bekerja…` (live) · `Stream terputus — menyambung ulang…` (limit).
- **Mode edit** (alur stop → revert → edit → kirim ulang, `[SPEC-C Phase 6.3 + SPEC-R R7]`, mesin status `idle → streaming → stopped → editing → resent → streaming`):
  1. `streaming`: composer menampilkan `.fx-stop`; STOP menghentikan stream (interrupt) dan membekukan blok aktif di tengah kalimat; chip merah `■ Dihentikan oleh kamu` pada blok.
  2. `stopped → editing`: prompt terakhir kembali utuh ke composer; composer beralih `.fx-composer.is-editing` + `.fx-edit-bar` tampil (REVERT / BATAL / KIRIM ULANG); bagian yang diubah user ditandai `.fx-edit-old` (coret merah) vs `.fx-edit-new` (hijau).
  3. `editing → resent`: KIRIM ULANG mengirim prompt hasil edit sebagai blok `user` baru berbadge `diedit`; percobaan lama menyusut jadi ruas abu di tulang: `Percobaan 1 · dihentikan · direvert` (status `reverted`).
  4. REVERT di edit bar = kembalikan teks ke prompt asli sebelum edit; BATAL = buang mode edit tanpa mengirim.
  - Ambiguitas istilah yang harus disadari implementer: kata "revert" di sumber berarti dua hal — (a) alur composer di atas, dan (b) dukungan revert sesi di upstream flux-webui (stage/clear/commit) `[KONTEKS]`. Pemetaannya adalah Pertanyaan Terbuka #14.

---

## 5. Checklist Adegan Video HD — Lingkup N4

Sumber: tabel adegan Blueprint Rekonstruksi Bagian 1 (video 94 dtk). Status pengujian hanya boleh `PASS` / `FAIL` / `NOT TESTED` / `SIMULATED` `[SPEC-R prinsip 8]`, diuji di runtime WebView/browser asli (TEST A = gerbang N8; checklist ini yang dipakai di sana untuk sisi chat). Adegan campuran dipisah: bagian chat di sini, bagian explorer di N5.

| Waktu | Adegan | Milik N4 — yang harus terlihat | Verifikasi TEST A (sisi chat) |
|---|---|---|---|
| 0–3 dtk | Sekat explorer menempel di kanan kolom chat | Bukan N4 (kerangka split = N5). N4 hanya menjamin kolom chat utuh berdiri sendiri | — (N5) |
| 3–8 dtk | User mengetik prompt di composer | Composer kapsul menerima teks; cairan konteks & label model terlihat | Ketik prompt asli → teks tampil, kapsul mengembang maks 5 baris |
| 8–11 dtk | Agent bekerja, user tekan STOP | `.fx-stop` tampil selama streaming; stream membeku di tengah kalimat; chip `■ Dihentikan oleh kamu` | Jalankan prompt panjang → tekan STOP di tengah stream → blok berstatus stopped, teks berhenti persis di kata terakhir yang tiba |
| 11–18 dtk | Revert → Mode Edit | Composer `.is-editing` + `.fx-edit-bar`; teks lama coret merah (`.fx-edit-old`), teks baru hijau (`.fx-edit-new`) | Dari keadaan stopped: masuk mode edit, ubah sebagian teks → coret/highlight tampil pada bagian yang benar |
| 18–21 dtk | Kirim ulang; percobaan lama jadi ruas abu | Blok `user` baru berbadge `diedit`; percobaan lama = ruas abu `reverted` di tulang | KIRIM ULANG → agent menjalankan prompt **hasil edit** (bukan prompt awal); ruas abu percobaan lama tetap ada di tulang |
| 21–27 dtk | Thought simpul + streaming + slab Explored | Simpul Thought berdenyut saat live, label durasi berjalan; teks streaming menumpuk di satu blok dengan kursor; slab kode scroll internal + baris aktif | Jalankan tugas yang memicu reasoning + baca file → ketiga blok muncul berurutan; Thought 59 dtk-class tampil dobel (uji durasi panjang boleh SIMULATED untuk durasinya, tampilannya PASS/FAIL terpisah) |
| 27–34 dtk | Berkas Auto Follow menyeberang ke tree | — | N5 |
| 34–41 dtk | DETEKSI PROJECTS → daftar card | — | N5 |
| 41–46 dtk | Card dipilih → Project Root Tree | — | N5 |
| 46–49 dtk | HOME ROOT → Home Root Tree | — | N5 |
| 49–56 dtk | File di tree menyala amber; log streaming internal | **Bagian N4:** blok `log` mengalir di slab internal saat agent bekerja; halaman chat tidak memanjang | Picu perintah ber-log panjang → log masuk slab, penghitung baris naik, tinggi halaman tetap; (nyala amber di tree = N5) |
| 56–59 dtk | Agent memeriksa isi `logs/`; target follow `app.log` | **Bagian N4:** blok `code`/`log` untuk pembacaan log tampil normal | Sama seperti 21–27 untuk file log; (perpindahan follow = N5) |
| 59–64 dtk | `logs/` dicoret merah lalu hilang dari tree | **Bagian N4 (parsial):** blok `delete` node merah di kolom chat bila sumber data mendukungnya | (Tree & retarget = N5; keberadaan blok delete di chat dicatat apa adanya: PASS/FAIL/NOT TESTED) |
| 64–68 dtk | Target terhapus → follow pindah ke induk | — | N5 |
| 69–77 dtk | Segitiga 1,5 dtk menyembunyikan Global Navigation; Auto Follow tetap jalan | — (mekanisme explorer; kolom chat tidak boleh berubah state karenanya) | N5 — sisi chat cukup memastikan sesi/stream tidak terganggu |
| 77–87 dtk | Selesai: verifikasi PASS, ringkasan + Salin Ringkasan → Tersalin | Segel PASS hijau; blok `summary` struktur tetap; tombol Salin Ringkasan → `✓ Tersalin` + toast | Selesaikan satu sesi penuh → pola diff → segel → ringkasan; tekan Salin Ringkasan → tempel di aplikasi lain → struktur teks sama persis dengan layar |
| 87–94 dtk | Keadaan akhir stabil: satu state, tanpa Back | Kolom chat stabil di ringkasan; tidak ada blok menggantung | Amati keadaan akhir ≥5 dtk: tidak ada animasi liar / blok berubah sendiri |

Uji fungsional tambahan dari Blueprint Chat Phase 10.1 yang wajib masuk TEST A sisi chat:

- [ ] Log 500+ baris: halaman tidak memanjang; pill Jump to latest muncul hanya saat user tertinggal di atas dan bekerja.
- [ ] Error build yang disengaja: retakan + node kotak merah muncul, penjelasan asisten menyertai, perbaikan menutup dengan segel PASS; tulang di atas titik error tetap retak.
- [ ] Limit disimulasikan (429): stream berhenti di tengah kalimat, cincin hitung mundur jalan, fallback melanjutkan dari kata terakhir di blok yang sama — status jujur: `SIMULATED` untuk pemicunya.
- [ ] Salin log dari header slab → tempel → jumlah baris sama dengan penghitung di header.
- [ ] `prefers-reduced-motion` aktif: semua animasi mati, semua fungsi tetap jalan.
- [ ] Lebar layar 360px: tidak ada teks kepotong; target sentuh ≥40px (baris command 44px).
- [ ] Daftar sesi: berpindah sesi mengganti isi tulang secara utuh; event SSE sesi lain tidak mengubah tampilan sesi aktif.

---

## 6. Pertanyaan Terbuka

Hal-hal yang **tidak** diselesaikan sumber mana pun. Status finalisasi: #1, #3, #4, #5, #6, #7, #8, #9, #11, #12, #14, #16, #17 SUDAH DIPUTUSKAN di Bagian 0. Yang tersisa sebagai pekerjaan discovery N4 (dibuktikan dari data nyata, bukan diputuskan di atas kertas): #2, #10, #13, dan sebagian #15.

1. **Daftar sesi tidak punya desain.** Kedua blueprint hanya merancang kolom chat; daftar sesi (bentuk, posisi, class) tidak ada di sumber. Padahal mengganti sesi adalah pintu masuk kolom. Perlu keputusan: laci/overlay/layar tersendiri? Class `.fx-*` baru atau di luar sistem `.fx-`?
2. **Pemetaan event SSE nyata flux-webui → `FluxKind` belum ada.** Tabel Blueprint Chat Phase 3 memakai nama event project lama dan memerintahkan penyesuaian. Nama `type` envelope yang benar-benar dikirim upstream OpenCode lewat relay flux (event pesan, bagian pesan, permission, revert, dsb.) dan field penanda sesi di tiap tipe harus dipetakan dari bukti (capture/discovery), bukan ditebak dari tabel lama.
3. **Permission ask/reply tidak punya kind/anatomi.** Lingkup N4 mencakup UI permintaan izin tool (ask → reply setuju/tolak), tetapi kedua blueprint diam total soal bentuknya: kind baru? Varian blok `command`? Posisi di tulang dan state-nya (menunggu/jawab/kedaluwarsa) belum dirancang.
4. **Tiga lubang di peta kind.** (a) Warna/bentuk node `diff` dan `summary` tidak ditetapkan sumber (prinsip "Selesai = segel cincin penuh" hanya petunjuk arah untuk summary). (b) Kind `research` ada di tipe & token (violet) tanpa anatomi apa pun. (c) Segel verifikasi Phase 7.2 tidak punya `FluxKind` — dirender sebagai blok sendiri, bagian dari `summary`, atau bagian dari blok `command` verifikasi?
5. **Simpul mata Explored vs lingkaran CSS.** Blueprint Chat §5.1 memerintahkan node Explored berbentuk simpul mata (SVG elips + titik); CSS Phase 2 yang sudah jadi memberi lingkaran hijau biasa lewat `::before`. Mana yang berlaku di N4 — dan bila mata menang, bagaimana implementasinya tanpa merusak keselarasan node di `--fx-spine-x`?
6. **Konflik nama & nilai antar blueprint.** (a) Ruas abu: `.fx-attempt-collapsed` (Blueprint Chat: opacity .55, saturasi .3, mono 11,5px) vs `.fx-attempt` (Rekonstruksi: opacity .45, saturasi .2). (b) `.fx-edit-old`: Blueprint Chat `color: #f8a5a5` dengan coret berwarna `--fx-red`; Rekonstruksi `color: var(--fx-red)`. `.fx-edit-new`: Blueprint Chat `background: rgba(74,222,128,.16); color: #aef5c3`; Rekonstruksi hanya `color: var(--fx-green)`. Satu versi harus dipilih saat finalisasi.
7. **Elemen bernama perilaku, tanpa class.** Pill `↓ Jump to latest`, chip `■ Dihentikan oleh kamu`, badge `diedit`, baris fallback hijau blok limit, dan cincin segel belum punya nama class maupun token di sumber (Bagian 2.10). Perlu penamaan resmi agar implementer tidak mengarang sendiri-sendiri.
8. **Blok Akses belum punya class & scope token.** Gerbang auth berada di luar ruang lingkup kedua blueprint. Belum diputuskan: apakah gerbang hidup di dalam `.fx-col` (mewarisi token) atau scope token sendiri; class untuk kartu, meter, sub-node, dan footer RANTAI SISTEM belum dinamai. (Ada `[PROPOSAL]` penulis draft di Bagian 4.1.)
9. **`--fx-progress` belum punya definisi flux-webui.** CSS menyebutnya "progres sesi 0–100%", tetapi tidak ada sumber yang mendefinisikan progres sesi dihitung dari apa (jumlah blok? fase? token?) di sistem flux-webui.
10. **Sinyal limit & fallback di flux-webui belum dibuktikan.** Anatomi blok `limit` diwarisi dari project lama (429, fallback model via 9Router, pemadatan konteks). Apakah upstream/adapter flux memunculkan event & data yang setara — dan apakah fallback model adalah perilaku upstream, bukan lapisan UI — harus dibuktikan di discovery; bila tidak ada padanannya, blok ini mungkin tidak terpicu di N4.
11. **Payload per kind belum ditipkan.** Selain `CommandItem`, sumber tidak memberi bentuk `payload` untuk kind lain (isi slab kode, baris log, data diff, isi ringkasan, dsb.). Implementer membutuhkan definisi payload per kind yang diturunkan dari data REST/SSE nyata (berkaitan dengan #13).
12. **Baris "Dihapus" di ringkasan: N4 atau nanti?** Penambahan baris Dihapus datang dari Blueprint Rekonstruksi R9 (fase gabungan, sesudah R8 soal hapus/retarget). Apakah ringkasan N4 sudah memuatnya, atau menunggu fase hapus — belum diputuskan sumber.
13. **Bentuk isi `content` pesan assistant BELUM diprobe (discovery N4 wajib).** Yang sudah diketahui `[KONTEKS]`: record pesan datar per role — user: `agents/files/id/text/time/type`; assistant: `agent/content/id/model/time/type`. Tetapi **struktur di dalam `content` assistant belum pernah diperiksa**: bagaimana teks, reasoning, dan pemanggilan tool direpresentasikan di dalamnya menentukan seluruh pemetaan REST → `FluxBlock` (Bagian 3). Ini item discovery pertama N4, sebelum kode blok ditulis.
14. **Dua makna "revert" harus dipetakan.** Blueprint memakai revert sebagai alur composer (stop → prompt kembali → edit → kirim ulang, dengan edit bar yang juga punya tombol bernama REVERT untuk memulihkan teks asli). Upstream flux-webui punya revert sesi sendiri (stage/clear/commit) dan edit pesan via PATCH `[KONTEKS]`. Alur visual mana menempel ke mekanisme upstream mana — dan apakah ruas abu `reverted` berkaitan dengan revert sesi upstream atau murni urusan tampilan composer — belum dipetakan sumber.
15. **Label model & persen konteks composer belum punya sumber data.** Blueprint lama menulis pill `<model> · 9Router` dan label `konteks N%` dari konteks project lama. Di flux-webui: label model diambil dari field sesi/pesan mana, dan persen konteks dihitung dari apa (field `tokens` pada sesi? dibagi batas konteks model dari mana?) — tidak diatur sumber.
16. **Token geometri bersifat tetap; aturan responsif tidak ada.** `--fx-spine-x: 40px` dan `--fx-node: 14px` adalah nilai tunggal dari CSS; video patokan beresolusi 1440×2560. Sumber tidak memberi aturan skala untuk lebar layar berbeda (360px disebut hanya sebagai kasus uji). Apakah token tetap dipakai apa adanya di semua lebar adalah keputusan finalisasi.
17. **Paginasi sesi panjang tidak dirancang.** Daftar pesan flux-webui berpaginasi (order/limit/cursor eksplisit) `[KONTEKS]`, tetapi blueprint mengasumsikan seluruh blok sesi tampil dalam satu tulang. Cara memuat blok yang lebih lama (scroll ke atas? tombol?) dan pengaruhnya ke posisi `.fx-flow`/scroll belum dirancang di sumber mana pun.

---

---

## 7. Revisi Panel Sesi — DITERIMA Erix (2026-11-17 malam) [MENGIKAT]

Referensi visual mengikat untuk wilayah panel sesi: **`panel-sesi-flow.mp4`** (36,5 dtk) + `session-list-cards.png` + `thin-panel-chat.png` + `new-session-dialog.png`. Bila Bagian 7 bertentangan dengan Bagian 0 #1, Bagian 2.8, atau Bagian 4.2 soal daftar sesi, **Bagian 7 yang berlaku**. Class `.fx-corner-btn` dan `.fx-drawer` PENSIUN untuk keperluan daftar sesi. Penanda asal bagian ini: `[KEPUTUSAN]`.

### 7.1 Bar sesi — `.fx-sessionbar`
Satu baris, full-width mentok kanan-kiri, menempel di atas kolom chat, **ditipiskan maksimal** (target tinggi ±36–40px; seluruh bar adalah satu target sentuh — tidak ada tombol terpisah di dalamnya selain chevron visual). Isi kiri→kanan: titik status (hijau bernafas = terhubung), nama sesi aktif (sans bold), label model sesi (mono, redup), lencana proses `.fx-process-badge` (amber: jumlah sesi LAIN yang sedang berproses + titik berdenyut; tidak dirender bila nol), chevron buka/tutup di ujung kanan. Bar ini satu-satunya pintu daftar sesi; pola hamburger/laci dilarang.

### 7.2 Daftar sesi — `.fx-session-list`
Kolom yang meluncur turun dari bar (transisi geser ±300ms) dan menempati wilayah di bawah bar selama terbuka; daftar bergulir di dalam kolomnya sendiri. Isi: kepala `DAFTAR SESI` + hitungan sesi (dari data nyata), kartu-kartu sesi, dan kartu tambah sesi (di ekor daftar atau menempel di bawah daftar — satu pilihan, konsisten).

### 7.3 Kartu sesi — `.fx-session-card`
Satu sesi per kartu; simpul tulang mini hidup di sisi kiri kartu. Isi kartu: simpul status, judul sesi, chip status, baris model, baris meta (waktu relatif · token · jumlah pesan — hanya dari data nyata), dan dua tombol aksi yang selalu tampak: pensil (rename / ganti model) dan tong sampah (delete). Keadaan `[data-state]`: `active` (bingkai + chip cyan `AKTIF` — sesi yang sedang dibuka), `run` (bingkai + chip amber `PROSES`), `idle` (redup, tanpa chip).

### 7.4 Animasi keadaan `run` (bahasa animasi resmi — sederhana, CSS murni)
(a) Spinner busur menggantikan simpul kartu: rotate 0,9s linear infinite, amber. (b) Teks `Sedang bekerja` + tiga titik berdenyut (pulse 1,2s, jeda bertingkat 0 / 0,15 / 0,3s). (c) Bar tipis di kaki kartu: kilau menyapu (sweep 2s) di atas rel; isi bar proporsional HANYA bila ada data nyata (mis. hitungan langkah dari event) — selain itu indeterminate. Teks meta `berjalan … · langkah …` hanya dari sumber nyata; tanpa sumber, tampilkan durasi saja atau kosong. **Dilarang mengarang persen/langkah.** Lencana proses di bar memakai denyut yang sama.

### 7.5 Alur rename
Pensil di kartu → kartu mengembang: kolom nama (nilai awal = nama sekarang) + tombol `SIMPAN`. Simpan memanggil mekanisme ganti judul upstream — **wajib dibuktikan pada discovery N4.4** (endpoint update sesi). Bila upstream tidak menyediakan cara mengganti judul, degrade dengan jujur dan laporkan; jangan berpura-pura tersimpan. Sukses: kartu berkedip hijau sesaat.

### 7.6 Alur delete
Tong sampah → kartu mengembang: konfirmasi sebaris `Hapus sesi ini?` + `Batal` / `HAPUS` (merah). `HAPUS` memanggil endpoint delete upstream (dibuktikan di discovery); kartu runtuh (collapse) dan hitungan sesi berkurang. Menghapus sesi yang sedang berproses: hentikan dulu (interrupt) baru hapus, atau tolak dengan pesan jelas — mengikuti perilaku upstream yang terbukti; tidak boleh diam-diam gagal.

### 7.7 Alur ganti model dari kartu
Baris model pada kartu membuka daftar model; kontraknya sama dengan pemilih model composer (N4.3 Tahap 3: daftar model + cara memasang dibuktikan dari upstream). Pilihan yang terpasang menimpa label model kartu. Degradasi jujur sama seperti pemilih composer.

### 7.8 Alur sesi baru
Kartu `+ Sesi baru` → dialog (lembar dari bawah): chip `SERVER` (hari ini hanya lokal Termux; pilihan lain menyusul jalur multi-server), chip `PROJECT`, baris `WORKING DIRECTORY` (location sesi), lalu berurutan: ① `NAMA SESI` (kolom teks) → ② `PILIH MODEL` (radio; hint pemakaian model diperbolehkan) → ③ `RUN IN`: `Local` (default) / `New worktree` — worktree HANYA opsi aktif bila upstream terbukti mendukung isolasi worktree pada discovery; bila tidak, opsi disembunyikan atau nonaktif berlabel belum didukung → tombol `START CHAT` membuat sesi (judul + model + direktori sesuai kontrak terbukti), dialog menutup, kartu sesi baru muncul di puncak daftar, dan pengguna masuk ke chat sesi itu.

### 7.9 Soliditas layout
Shell mengunci lebar device: tidak ada overflow horizontal dalam keadaan apa pun (bar, daftar, dialog, kolom chat). Yang bergulir hanya kolom chat (vertikal) dan daftar sesi (vertikal, internal). Aturan ini menambah Bagian 0 #16 untuk wilayah panel sesi.

### 7.10 Session Usage [KEPUTUSAN — DITERIMA Erix 2026-11-17 23:44]
Fungsinya meniru panel "Session usage" pada contoh Erix (screenshot 23:44 WIB), tetapi kulit dan bahasa desainnya SPINE//FLUX. **Penempatan (prinsip anti-menumpuk): tidak ada panel permanen baru.** Tiga titik hidupnya:
1. **Titik masuk utama** — strip status tipis **di bawah composer** (`.fx-underbar`): hairline konteks selebar strip + label mono `konteks N% · X of Y`; ketuk stripnya → lembar statistik sesi aktif (`.fx-usage-sheet`) meluncur dari bawah menimpa kolom chat yang diredupkan; tutup via `Close`/✕, ketuk di luar, atau geser turun. **Interior composer DIPESAN untuk fitur plan/build mendatang (keputusan Erix 2026-11-17 23:51 WIB) — label konteks TIDAK di dalam composer, dan jangan menaruh kontrol lain di dalamnya.** (Penempatan ini memurnikan Bagian 0 #15: sumber datanya sama, tempat tinggal labelnya di `.fx-underbar`.)
2. **Bar konteks mini di kartu sesi** — garis rambut (hairline) di kaki tiap kartu `.fx-session-card` + label `konteks N%` di baris meta: murni tampilan, untuk memantau sesi latar tanpa membukanya. Warna: cyan normal, amber ≥80%, merah ≥95%.
3. **Baris `Statistik sesi`** di menu kartu (pensil) — membuka lembar usage sesi itu tanpa berpindah sesi.

Isi lembar (atas→bawah): kepala simpul + `SESSION USAGE` + nama sesi + `Close`; baris biaya `Estimated API cost` — angka dolar hanya bila sumber harga terbukti, selain itu tampilkan status `Pricing unavailable` (kenyataan lingkungan ini: model `:free` via 9Router; jangan menampilkan angka karangan); blok `Context utilization`: persen besar + bar + format `X of Y input tokens` (tokens sesi ÷ limit model, sumber Bagian 0 #15; angka diringkas K/M); catatan kejujuran `Rincian mencakup riwayat yang termuat.` bila ada bagian yang diturunkan dari pesan terpaginasi; kartu rincian per model: provider, nama model, dan baris statistik mono `in · out · reasoning · cache read · cache write · steps`. Pada utilisasi ≥80% lembar menampilkan saran pasif: pertimbangkan sesi baru + minta ringkasan (bukan pop-up).

Sumber data: total token dari field `tokens` record sesi (kumulatif — terbukti di discovery N4). Rincian PER MODEL dan `steps` adalah **item discovery N4.4**: bila pesan assistant membawa token/model per pesan, rincian dihitung dari sana (dengan catatan riwayat termuat); bila tidak, rincian tampil agregat satu blok berlabel model sesi saat ini — dilarang memecahnya secara karangan.

### 7.11 Penempatan phase
Dikerjakan di **N4.4** (setelah N4.3 menutup inti chat), menggantikan komponen `SessionDrawer`; Shell menata ulang: `.fx-sessionbar` di atas `.fx-col`. Gerbang mengikuti pola tetap: harness diperluas + commit/push + TEST A oleh Erix.

---

---

## 8. Revisi Interaksi Agent — Popup Permission & Fitur Question (DITERIMA Erix 2026-11-17 23:58 WIB) [MENGIKAT]

### 8.1 Permission: popup auto + tiga tombol (kartu Bagian 0 #3 tetap)
- **Auto popup** — saat permintaan izin tiba untuk sesi AKTIF: lembar `.fx-permission-sheet` meluncur dari bawah menimpa chat yang diredupkan (keluarga gerak yang sama dengan `.fx-usage-sheet`). Isi: simpul amber berdenyut + header mono `IZIN DIMINTA` + nama sesi; nama tool + ringkasan input (slab mono, bisa diperluas); baris cakupan Always (lihat bawah); tiga tombol: `ALLOW ONCE` (garis hijau), `ALWAYS ALLOW` (garis amber + subteks cakupan), `REJECT` (garis merah). Popup TIDAK hilang sendiri, TIDAK menjawab sendiri, dan menahan composer sampai dijawab atau kedaluwarsa.
- **Sesi latar** — permintaan untuk sesi yang tidak sedang dibuka TIDAK memaksa popup: kartu sesi itu mendapat lencana peringatan `.fx-card-alert` (amber, berdenyut) dan hitungannya ikut tampil di area lencana bar; mengetuknya membuka daftar → sesi → popup-nya. Antrean global: satu popup pada satu waktu, urutan kedatangan, indikator `1 dari N`.
- **ALWAYS ALLOW** — sebelum ditekan, popup menampilkan cakupan persisnya (tool + pola perintah/path sebagaimana disediakan upstream). Mekanismenya **item discovery N4.4**: (a) bila endpoint reply upstream menerima nilai `always`, pakai itu; (b) bila tidak, fallback daftar izin tersimpan sisi klien per sesi (pola cocok → balas `once` otomatis) yang WAJIB terlihat dan bisa dicabut dari menu kartu sesi (baris `Izin tersimpan`). Dilarang menampilkan Always seolah persisten bila sebenarnya tidak.
- Hasil jawaban masuk ke kartu tulang sesuai Bagian 0 #3, dengan teks hasil yang membedakan pilihan: `✓ Diizinkan sekali` / `✓ Selalu diizinkan` / `✗ Ditolak` — `<tool>`. Keadaan kedaluwarsa ditampilkan apa adanya: popup berubah menjadi pemberitahuan kedaluwarsa dan tombol-tombolnya mati.

### 8.2 Fitur Question — `.fx-question`
Agent dapat bertanya dan berhenti menunggu jawaban user (mekanisme question upstream).
- **Permukaan ganda seperti permission**: kartu `.fx-question` di tulang (pertanyaan + jawaban terpilih, sebagai catatan permanen) + lembar `.fx-question-sheet` yang muncul otomatis untuk sesi aktif; sesi latar memakai lencana `.fx-card-alert` yang sama dengan 8.1.
- **Isi lembar**: header mono violet `PERTANYAAN DARI AGENT` + nama sesi; teks pertanyaan; pilihan jawaban sebagai baris penuh yang bisa diketuk (label + deskripsi bila upstream menyediakannya); kolom jawaban bebas bila upstream mengizinkan jawaban kustom; beberapa pertanyaan sekaligus dirender bertahap dengan indikator `Pertanyaan i dari n`.
- **Status menunggu**: selama question belum dijawab, sesi berstatus MENUNGGU — kartu sesinya menampilkan chip `MENUNGGU JAWABAN` (violet), menggantikan `PROSES` (agent tidak sedang bekerja; dia terblokir oleh user).
- **Discovery wajib (N4.4)**: nama event question, bentuk payload (jumlah pertanyaan, bentuk opsi, dukungan multi-pilih dan jawaban kustom), endpoint + body reply, dan semantik menolak/menutup tanpa menjawab. Bila upstream ternyata TIDAK punya mekanisme question, fitur ini gugur dengan bukti tertulis di laporan — jangan dibuat-buat.

### 8.3 Aturan bersama lapisan popup
Satu lembar pada satu waktu untuk semua jenis yang menunggu jawaban (permission, question); lembar usage tidak ikut antre karena hanya dibuka manual. Popup tidak pernah menumpuk; Gate login selalu di atas segalanya; tidak ada jawaban otomatis dalam keadaan apa pun. Versi web memakai popup di dalam aplikasi; notifikasi level OS dicatat sebagai pertimbangan phase APK (N9), bukan sekarang.

### 8.4 Penempatan phase & gerbang
Masuk scope **N4.4** (bersama panel sesi Bagian 7 + Session Usage 7.10). Discovery kontrak permission/question adalah langkah pertama di dalam phase itu. Harness diperluas bila skenarionya bisa dipicu di sesi scratch (panggilan tool yang memicu izin; question bila bisa dipicu); yang tidak bisa dipicu otomatis dicatat NOT TESTED dan menjadi skenario TEST A manual Erix. Klaim PASS penuh untuk permission dilarang tanpa bukti live minimal satu kali.

### 8.5 Lampiran — Peta permission dari project lama (bahan discovery, BUKAN kontrak terbukti)
Disampaikan Erix 2026-11-18 00:07 WIB, hasil pemetaan project lama (28571) terhadap upstream yang sama. Status: pengetahuan protokol — **WAJIB diverifikasi ulang satu per satu ke upstream live pada discovery N4.4** sebelum dipakai. Kode lama tidak disalin; nama file lama (`PermissionPopup.tsx`, `permissionPolicy.ts`, `opencodeClient.ts`) hanya penunjuk lokasi konsep.
- `GET /api/permission/request` — daftar permission request yang menunggu (global).
- `GET /api/session/{sessionID}/permission` — permission aktif dalam satu sesi.
- `POST /api/session/{sessionID}/permission/{permissionID}/reply` — kirim jawaban. Payload yang pernah diuji: `{"reply":"once"}` dan `{"reply":"always"}`. Payload reject BELUM pernah dikutip dari pengujian — wajib verifikasi (kandidat `{"reply":"reject"}`).
- `GET /api/permission/saved` — aturan permission tersimpan: bukti bahwa mekanisme Always adalah aturan persisten di upstream, bukan sekadar sisi klien. Ini hipotesis utama untuk 8.1(a); fallback klien 8.1(b) hanya bila verifikasi membantahnya.
- ⚠️ **Temuan wildcard**: pernah ada aturan tersimpan berpola wildcard yang membuat Reject terasa tidak berfungsi (permintaan ter-izin otomatis oleh aturan sebelum user sempat menolak). Konsekuensi desain: (1) daftar `Izin tersimpan` di menu kartu sesi adalah WAJIB dan harus mampu menghapus aturan, termasuk yang berpola wildcard; (2) permintaan yang lolos otomatis oleh aturan tersimpan tetap meninggalkan kartu hasil di tulang bertuliskan `Diizinkan otomatis — aturan tersimpan`, lengkap dengan jalan mencabut aturannya; (3) discovery wajib menguji perilaku ini secara eksplisit.
- Question: project lama TIDAK pernah mengimplementasikannya dan tidak ada endpoint Question yang diketahui. Discovery 8.2 mulai dari nol; pola sejajar (mis. kandidat `GET /api/question/...`) boleh diuji read-only — tetap dilarang mengarang endpoint.

---

*Akhir draft. Langkah berikutnya di luar dokumen ini: Muse meninjau draft, memutuskan Pertanyaan Terbuka yang bersifat desain, lalu menyusun prompt eksekusi N4 (termasuk discovery untuk #2, #10, #13) dari spec yang sudah final. — Ditambah Bagian 7 pada revisi 2026-11-17 malam (panel sesi diterima Erix dari video panel-sesi-flow.mp4); Bagian 7.10 pada 23:44–23:51 (Session Usage diterima + koreksi penempatan .fx-underbar); Bagian 8 pada 23:58 (popup permission + fitur question diterima Erix).*
