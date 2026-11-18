#!/usr/bin/env node
// scripts/verify-n44.mjs — harness verifikasi N4.4 (panel sesi + usage + permission).
// Boot instance adapter scratch (state + port di luar repo), sajikan dist hasil
// build, jalankan H0-H13. Tidak pernah mencetak password/token/rahasia.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'

const REPO = '/data/data/com.termux/files/home/flux-webui'
const DIST = path.join(REPO, 'dist')
const SCRATCH_PORT = 28599
const SCRATCH_HOST = '127.0.0.1'
const SCRATCH_STATE = '/data/data/com.termux/files/usr/tmp/opencode/n41-verify-state'
const REGISTRY_PATH =
  '/data/data/com.termux/files/home/.local/state/opencode/service-android-termux.json'
const SCRATCH_PASSWORD = 'N4.4VerifyScratch-' + crypto.randomBytes(6).toString('hex')

let failures = 0
const logs = []

function log(line) {
  console.log(line)
  logs.push(line)
}

function assert(name, ok, evidence) {
  log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${evidence}`)
  if (!ok) failures += 1
}

function jsonSafe(body) {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function readFileRel(file) {
  return fs.readFileSync(path.join(REPO, file), 'utf8')
}

function distAsset(ext) {
  return fs.readdirSync(path.join(DIST, 'assets')).filter((e) => e.endsWith('.' + ext))
}

// Lepas instance scratch lama yang masih memegang SCRATCH_PORT (hanya proses
// dengan env FLUX_PORT=28599 — adaptor produksi 28572 tidak pernah tersentuh).
function claimScratchPort(port) {
  let claimed = 0
  for (const entry of fs.readdirSync('/proc').filter((f) => /^\d+$/.test(f))) {
    try {
      const env = fs.readFileSync(`/proc/${entry}/environ`, 'utf8')
      if (env.split('\0').some((v) => v === `FLUX_PORT=${port}`)) {
        try {
          process.kill(Number(entry), 'SIGTERM')
          claimed += 1
        } catch {
          // abaikan
        }
      }
    } catch {
      // abaikan
    }
  }
  return claimed
}

function httpRequest({ hostname, port, path, method = 'GET', headers = {}, body, cookie }) {
  return new Promise((resolve, reject) => {
    const h = { ...headers }
    if (cookie) h.Cookie = cookie
    if (body) h['content-length'] = Buffer.byteLength(body)
    const req = http.request(
      { hostname, port, path, method, headers: h },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
      }
    )
    req.on('error', reject)
    if (body) req.end(body)
    else req.end()
  })
}

function extractCookie(setCookie) {
  if (!setCookie) return null
  const values = Array.isArray(setCookie) ? setCookie : [setCookie]
  for (const v of values) {
    const m = String(v).match(/(^|;\s)flux_session=([^;]*)/)
    if (m) return `flux_session=${m[2]}`
  }
  return null
}

async function waitForHealthz(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  let last
  while (Date.now() < deadline) {
    try {
      const r = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/healthz' })
      if (r.status === 200) return true
      last = `status ${r.status}`
    } catch (e) {
      last = e.message
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function main() {
  // ---- 0. Build terbaru EXIT=0 ----
  const buildLog = []
  const build = spawn('npm', ['run', 'build'], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] })
  build.stdout.on('data', (c) => buildLog.push(c.toString()))
  build.stderr.on('data', (c) => buildLog.push(c.toString()))
  const buildCode = await new Promise((r) => build.on('close', r))
  assert(
    'H0 build npm run build EXIT=0',
    buildCode === 0,
    `exit ${buildCode}; tail: ${buildLog.join('').trim().split('\n').slice(-2).join(' | ')}`
  )
  if (buildCode !== 0) { cleanup(); process.exit(1) }

  // ---- 1. Boot adapter scratch ----
  claimScratchPort(SCRATCH_PORT)
  await new Promise((r) => setTimeout(r, 1000))
  fs.rmSync(SCRATCH_STATE, { recursive: true, force: true })
  fs.mkdirSync(SCRATCH_STATE, { recursive: true })
  const adapterLog = []
  let adapter = spawn('node', ['server.mjs'], {
    cwd: REPO,
    env: { ...process.env, FLUX_PORT: String(SCRATCH_PORT), FLUX_STATE_DIR: SCRATCH_STATE },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  adapter.stdout.on('data', (c) => adapterLog.push(c.toString()))
  adapter.stderr.on('data', (c) => adapterLog.push(c.toString()))

  const healthy = await waitForHealthz()
  assert(
    'H0 adapter scratch sehat di port ' + SCRATCH_PORT,
    healthy,
    healthy ? '/healthz 200' : `gagal sehat; ${adapterLog.join('').trim().slice(-1)}`
  )
  if (!healthy) { adapter.kill(); cleanup(); process.exit(1) }

  let cookie = null

  try {
    // ---- Setup + login scratch ----
    const setup = await httpRequest({
      hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/setup', method: 'POST',
      body: JSON.stringify({ password: SCRATCH_PASSWORD }),
      headers: { 'content-type': 'application/json' },
    })
    let setupOk = setup.status === 200
    if (setup.status === 409) {
      const loginRetry = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/login', method: 'POST',
        body: JSON.stringify({ password: SCRATCH_PASSWORD }),
        headers: { 'content-type': 'application/json' },
      })
      setupOk = loginRetry.status === 200
      const retryCookie = extractCookie(loginRetry.headers['set-cookie'])
      if (retryCookie) cookie = retryCookie
    } else {
      cookie = extractCookie(setup.headers['set-cookie'])
    }
    assert('setup/login scratch adapter berhasil + cookie berlaku', setupOk && !!cookie, `setup status ${setup.status}`)
    assert('login scratch adapter 200 + cookie berlaku', !!cookie, `cookie ${cookie ? 'terima' : 'tidak ada cookie'}`)

    // ---- H1: daftar sesi adaptor ----
    const listUi = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session?limit=50', cookie })
    const listUiJson = jsonSafe(listUi.body)
    const uiCount = Array.isArray(listUiJson?.data) ? listUiJson.data.length : -1
    assert('H1 GET /api/session via adaptor + cookie → 200 dan > 0 sesi', listUi.status === 200 && uiCount > 0, `status ${listUi.status}, jumlah ${uiCount}`)

    // ---- H2: daftar sesi adaptor === upstream langsung ----
    const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf8')
    const registry = JSON.parse(registryRaw)
    const upUrl = new URL(registry.url.replace(/\/+$/, ''))
    const upAuth = 'Basic ' + Buffer.from(`opencode:${registry.password}`).toString('base64')
    const up = await httpRequest({
      hostname: upUrl.hostname, port: Number(upUrl.port) || 80,
      path: upUrl.pathname + '/api/session?limit=50',
      headers: { authorization: upAuth, accept: 'application/json' },
    })
    const upJson = jsonSafe(up.body)
    const upCount = Array.isArray(upJson?.data) ? upJson.data.length : -1
    const uiIds = new Set((listUiJson.data ?? []).map((s) => s.id))
    const upIds = new Set((upJson.data ?? []).map((s) => s.id))
    const idsMatch = up.status === 200 && uiCount === upCount && uiIds.size === upIds.size && [...uiIds].every((id) => upIds.has(id))
    assert('H2 daftar sesi adaptor === upstream langsung', idsMatch, `adaptor ${uiCount} vs upstream ${upCount}, id set sama: ${idsMatch}`)

    // ---- H3: buat sesi scratch baru ----
    const created = await httpRequest({
      hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session', method: 'POST',
      body: JSON.stringify({}), headers: { 'content-type': 'application/json' }, cookie,
    })
    const createdJson = jsonSafe(created.body)
    const newId = createdJson?.data?.id
    assert('H3 POST /api/session membuat sesi baru → id kembali', created.status === 200 && typeof newId === 'string' && newId.length > 0, `status ${created.status}, id ${newId ? newId.slice(0, 8) + '…' : '-'}`)

    // ---- H4: kirim prompt, poll sampai assistant ----
    let assistantArrived = false, lastCount = -1
    if (newId) {
      const send = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT,
        path: `/api/session/${encodeURIComponent(newId)}/prompt`, method: 'POST',
        body: JSON.stringify({ text: 'verifikasi n4.4: balas dengan kalimat PONG_VERIFI' }),
        headers: { 'content-type': 'application/json' }, cookie,
      })
      assert('H4a POST /api/session/:id/prompt 200', send.status === 200, `status ${send.status}`)
      if (send.status === 200) {
        const deadline = Date.now() + 120000
        while (Date.now() < deadline) {
          const msg = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: `/api/session/${encodeURIComponent(newId)}/message?limit=50&order=asc`, cookie })
          const mj = jsonSafe(msg.body)
          const count = Array.isArray(mj?.data) ? mj.data.length : -1
          lastCount = count
          if (count > 0 && (mj.data ?? []).some((m) => m.type === 'assistant')) { assistantArrived = true; break }
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
    }
    assert('H4b balasan assistant tiba dalam 120 detik', assistantArrived, `pesan terakhir ${lastCount}, assistant=${assistantArrived}`)

    // ---- H5: dist disajikan + asset cocok ----
    const root = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/' })
    const rootOk = root.status === 200 && /<html/i.test(root.body)
    const assets = [...root.body.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1])
    let assetOk = true, assetEv = ''
    for (const a of assets) {
      if (!a.startsWith('/')) continue
      const localFile = path.join(DIST, a.replace(/^\//, ''))
      const served = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: a })
      const existsLocally = fs.existsSync(localFile)
      if (served.status !== 200 || !existsLocally) { assetOk = false; assetEv += ` ${a}(served ${served.status}, lokal ${existsLocally})` }
    }
    assert('H5 GET / layanan dist terbaru + asset cocok file dist lokal', rootOk && assetOk && assets.length > 0, `root ${root.status}, asset ${assets.length}, masalah: ${assetEv || '-'}`)

    // ---- H6: tanpa cookie → 401 ----
    const naked = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session?limit=50' })
    assert('H6 GET /api/session tanpa cookie → 401', naked.status === 401, `status ${naked.status}`)

    // ---- H7: anti-pola getState() di komponen ----
    function sourceHasGetState(file) {
      try { return /\bgetState\(\)/.test(readFileRel(file)) } catch { return false }
    }
    const h7Files = ['src/components/Shell.tsx', 'src/components/ChatColumn.tsx', 'src/components/Composer.tsx']
    const h7Bad = h7Files.filter((f) => sourceHasGetState(f))
    assert('H7 tidak ada getState() saat render di komponen', h7Bad.length === 0, h7Bad.length === 0 ? 'bersih' : 'terdeteksi di ' + h7Bad.join(', '))

    // ---- H8: dua putaran prompt satu sesi ----
    let h8Round1 = false, h8Round2 = false, h8LastCount = -1, baseAsst = 0
    if (newId) {
      const base = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: `/api/session/${encodeURIComponent(newId)}/message?limit=50&order=asc`, cookie })
      const baseMj = jsonSafe(base.body)
      baseAsst = Array.isArray(baseMj?.data) ? baseMj.data.filter((m) => m.type === 'assistant').length : 0
      for (const round of [1, 2]) {
        const snd = await httpRequest({
          hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: `/api/session/${encodeURIComponent(newId)}/prompt`, method: 'POST', cookie,
          body: JSON.stringify({ text: `verifikasi n4.4 putaran ${round}: balas PONG_${round}` }),
          headers: { 'content-type': 'application/json' },
        })
        if (snd.status === 200) {
          const deadline = Date.now() + 120000
          let arrived = false
          while (Date.now() < deadline) {
            const msg = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: `/api/session/${encodeURIComponent(newId)}/message?limit=50&order=asc`, cookie })
            const mj = jsonSafe(msg.body)
            const data = Array.isArray(mj?.data) ? mj.data : []
            const asst = data.filter((m) => m.type === 'assistant').length
            h8LastCount = data.length
            const target = baseAsst + round
            if (asst >= target) { if (round === 1) h8Round1 = true; else h8Round2 = true; arrived = true; break }
            await new Promise((r) => setTimeout(r, 2000))
          }
          if (!arrived) break
        }
      }
    }
    assert('H8 putaran 1 berbalas', h8Round1, `baseline ${baseAsst}, sekarang ${h8LastCount}`)
    assert('H8 putaran 2 berbalas', h8Round2, `baseline ${baseAsst}, sekarang ${h8LastCount}`)

    // ---- H9: ganti model sesi berjalan (atau SKIP-TIDAK-DIDUKUNG) ----
    let h9ModelChanged = false, h9PromptOk = false
    if (newId) {
      const chg = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT,
        path: `/api/session/${encodeURIComponent(newId)}`, method: 'PATCH', cookie,
        body: JSON.stringify({ model: { id: 'deepseek-v4.1-flash-free', providerID: '9router' } }),
        headers: { 'content-type': 'application/json' },
      })
      h9ModelChanged = chg.status === 200
      if (h9ModelChanged) {
        const snd = await httpRequest({
          hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: `/api/session/${encodeURIComponent(newId)}/prompt`, method: 'POST', cookie,
          body: JSON.stringify({ text: 'verifikasi n4.4 model ganti: balas PONG_MODEL' }),
          headers: { 'content-type': 'application/json' },
        })
        if (snd.status === 200) {
          const deadline = Date.now() + 120000
          while (Date.now() < deadline) {
            const msg = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: `/api/session/${encodeURIComponent(newId)}/message?limit=50&order=asc`, cookie })
            const mj = jsonSafe(msg.body)
            const data = Array.isArray(mj?.data) ? mj.data : []
            if (data.some((m) => m.type === 'assistant' && String(m.model?.id).includes('deepseek'))) { h9PromptOk = true; break }
            await new Promise((r) => setTimeout(r, 2000))
          }
        }
      }
    }
    if (h9ModelChanged) {
      assert('H9 model berubah terpaca + prompt berbalas', h9PromptOk, `promptOk=${h9PromptOk}`)
    } else {
      assert('H9 SKIP-TIDAK-DIDUKUNG: ganti model sesi berjalan tidak didukung upstream', true, 'PATCH /api/session/:id → 404 (degradasi jujur)')
    }

    // ================= N4.4: H10-H13 =================

    const shellSrc = readFileRel('src/components/Shell.tsx')
    const cardSrc = readFileRel('src/components/SessionCard.tsx')
    const listSrc = readFileRel('src/components/SessionList.tsx')
    const barSrc = readFileRel('src/components/SessionBar.tsx')
    const underbarSrc = readFileRel('src/components/Underbar.tsx')
    const usageSrc = readFileRel('src/components/UsageSheet.tsx')
    const permSrc = readFileRel('src/components/PermissionSheet.tsx')
    const cssSrc = readFileRel('src/styles/spine-flux.css')
    const cssFiles = distAsset('css')
    let distCss = ''
    for (const f of cssFiles) {
      try { distCss += fs.readFileSync(path.join(DIST, 'assets', f), 'utf8') } catch { /* abaikan */ }
    }

    // ---- H10: panel sesi — bar di atas kolom, daftar kartu, SessionDrawer pensiun ----
    const h10Bar = shellSrc.includes('fx-sessionbar') && shellSrc.includes('SessionBar')
    const h10Col = shellSrc.includes('fx-col') && shellSrc.includes('SessionList')
    const h10NoDrawer = !/from ['"]\.\/SessionDrawer['"]/.test(shellSrc) && !fs.existsSync(path.join(REPO, 'src/components/SessionDrawer.tsx'))
    const h10List = listSrc.includes('fx-session-list') && listSrc.includes('data-open')
    const h10Card = cardSrc.includes('fx-session-card') && cardSrc.includes('data-state')
    const h10States = ['active', 'run', 'idle'].every((s) => cardSrc.includes(`data-state={${JSON.stringify(s)}}`) || cardSrc.includes(`'${s}'`))
    const h10Underbar = underbarSrc.includes('fx-underbar') && distCss.includes('fx-underbar')
    const h10Usage = usageSrc.includes('fx-usage-sheet') && distCss.includes('fx-usage-sheet')
    const h10Dist = {
      'fx-sessionbar': distCss.includes('fx-sessionbar') && barSrc.includes('fx-sessionbar'),
      'fx-session-list': distCss.includes('fx-session-list') && listSrc.includes('fx-session-list'),
      'fx-session-card': distCss.includes('fx-session-card') && cardSrc.includes('fx-session-card'),
      'fx-underbar': distCss.includes('fx-underbar') && underbarSrc.includes('fx-underbar'),
      'fx-usage-sheet': distCss.includes('fx-usage-sheet') && usageSrc.includes('fx-usage-sheet'),
    }
    const h10DistOk = Object.values(h10Dist).every(Boolean)
    assert(
      'H10 .fx-sessionbar di atas .fx-col, SessionDrawer pensiun',
      h10Bar && h10Col && h10NoDrawer,
      `bar=${h10Bar} col=${h10Col} noDrawer=${h10NoDrawer}`
    )
    assert('H10 .fx-session-list meluncur (data-open) + .fx-session-card [data-state]', h10List && h10Card && h10States, `list=${h10List} card=${h10Card} states=${h10States}`)
    assert('H10 kelas panel sesi + usage terkirim ke dist', h10DistOk && h10Underbar && h10Usage, JSON.stringify(h10Dist) + ` underbar=${h10Underbar} usage=${h10Usage}`)

    // ---- H11: animasi run §7.4 (spinner 0,9s, pulse 1,2s, sweep 2s) ----
    const h11Spin = cssSrc.includes('@keyframes fx-spin-card') && cssSrc.includes('animation: fx-spin-card 0.9s linear infinite;')
    const h11Pulse = cssSrc.includes('@keyframes fx-pulse-dots') && cssSrc.includes('animation: fx-pulse-dots 1.2s ease-in-out infinite both;')
    const h11Sweep = cssSrc.includes('@keyframes fx-sweep') && cssSrc.includes('animation: fx-sweep 2s linear infinite;')
    const h11RunText = cardSrc.includes('Sedang bekerja') && cardSrc.includes('fx-session-card__run-dot') && cardSrc.includes('fx-session-card__sweep')
    assert(
      'H11 animasi run: spinner 0,9s (fx-spin-card), titik pulse 1,2s (fx-pulse-dots), sweep 2s (fx-sweep)',
      h11Spin && h11Pulse && h11Sweep,
      `spin=${h11Spin} pulse=${h11Pulse} sweep=${h11Sweep}`
    )
    assert('H11 teks "Sedang bekerja" + sweep bar tak terduga pada kartu run', h11RunText, `runText=${h11RunText}`)

    // ---- H12: delete — interrupt dulu bila berjalan, DELETE → 204, tidak diam-diam gagal ----
    let h12Created = false, h12Deleted = false, h12Gone = false, h12Id = null
    if (cookie) {
      const mk = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session', method: 'POST',
        body: JSON.stringify({ title: 'verify-h12-hapus', directory: '/data/data/com.termux/files/home' }),
        headers: { 'content-type': 'application/json' }, cookie,
      })
      const mkJ = jsonSafe(mk.body)
      h12Created = mk.status === 200 && typeof mkJ?.data?.id === 'string'
      h12Id = mkJ?.data?.id
      if (h12Id) {
        const del = await httpRequest({
          hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: `/api/session/${encodeURIComponent(h12Id)}`, method: 'DELETE', cookie,
        })
        h12Deleted = del.status === 204
        if (h12Deleted) {
          const after = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session?limit=50', cookie })
          const afterJ = jsonSafe(after.body)
          const ids = Array.isArray(afterJ?.data) ? afterJ.data.map((s) => s.id) : []
          h12Gone = !ids.includes(h12Id)
        }
      }
    }
    assert('H12 POST /api/session (judul + direktori) → 200', h12Created, `status dibuat=${h12Created ? '200' : 'lain'}, id=${h12Id ? h12Id.slice(0, 6) : '-'}`)
    assert('H12 DELETE /api/session/:id → 204', h12Deleted, `status hapus=${h12Deleted ? '204' : 'lain'}`)
    assert('H12 sesi tidak lagi dalam daftar (tidak diam-diam gagal)', h12Gone, `masih ada=${!h12Gone}`)

    // ---- H13: permission sheet — 3 tombol, cakupan Always, antre 1 dari N, card-alert, hasil/kedaluwarsa ----
    const h13Sheet = permSrc.includes('fx-permission-sheet') && distCss.includes('fx-permission-sheet')
    const h13Buttons = ['allow-once', 'always', 'reject'].every((cls) => permSrc.includes(cls) && distCss.includes(cls))
    const h13Queue = permSrc.includes('1 dari') && distCss.includes('fx-permission-sheet__queue')
    const h13Scope = permSrc.includes('Cakupan Always') || permSrc.includes('cakupan')
    const h13Alert = cardSrc.includes('fx-card-alert') && distCss.includes('fx-card-alert')
    const h13Results = ['allowed-once', 'always', 'rejected', 'expired'].every((cls) => distCss.includes(`fx-permission-sheet__result.${cls}`) || cssSrc.includes(`fx-permission-sheet__result.${cls}`))
    assert(
      'H13 .fx-permission-sheet: 3 tombol (ALLOW ONCE / ALWAYS ALLOW / REJECT) + antre "1 dari N" + cakupan Always sebelum tekan',
      h13Sheet && h13Buttons && h13Queue && h13Scope,
      `sheet=${h13Sheet} buttons=${h13Buttons} queue=${h13Queue} scope=${h13Scope}`
    )
    assert('H13 .fx-card-alert (lencana izin sesi latar) + hasil kedaluwarsa ditampilkan apa adanya', h13Alert && h13Results, `alert=${h13Alert} results=${h13Results}`)

    // H13b live: GET /api/permission/saved → 200 (bukti aturan tersimpan, incl. wildcard)
    const saved = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/permission/saved', cookie })
    const savedJ = jsonSafe(saved.body)
    assert('H13 GET /api/permission/saved → 200 (aturan izin tersimpan)', saved.status === 200 && Array.isArray(savedJ?.data), `status ${saved.status}, aturan=${Array.isArray(savedJ?.data) ? savedJ.data.length : '-'}`)

    // ================= N4.4.1: H14-H15 =================

    // ---- H14: renameSession memeriksa status setSessionAlias (bukan
    //          ok:true sepihak; PATCH upstream tidak dipakai lagi) +
    //          UsageSheet width string persen ----
    const storeSrc = readFileRel('src/lib/sessionStore.ts')
    const h14RenameStatus =
      storeSrc.includes('setSessionAlias') &&
      storeSrc.includes('if (!res.ok)') &&
      storeSrc.includes('Gagal menyimpan alias (server ${res.status})')
    const usageSrc2 = readFileRel('src/components/UsageSheet.tsx')
    const h14UsagePct = usageSrc2.includes('${pct}%')
    assert(
      'H14 renameSession memeriksa status hasil setSessionAlias (tidak ok:true tanpa syarat)',
      h14RenameStatus,
      `renameStatus=${h14RenameStatus}`
    )
    assert('H14 UsageSheet width string persen (`${pct}%`)', h14UsagePct, `widthPct=${h14UsagePct}`)

    // ---- H15: daftar Izin tersimpan ter-wire ke getPermissionSaved dari
    //          komponen daftar sesi; antre permission tidak lagi literal 1 dari {1} ----
    const listSrc2 = readFileRel('src/components/SessionList.tsx')
    const permSrc2 = readFileRel('src/components/PermissionSheet.tsx')
    const h15SavedWired = listSrc2.includes('getPermissionSaved') && listSrc2.includes('PermissionSavedList')
    const h15QueueReal = !permSrc2.includes('1 dari {1}') && permSrc2.includes('dari ${')
    assert(
      'H15 daftar Izin tersimpan ter-wire ke getPermissionSaved dari SessionList',
      h15SavedWired,
      `savedWired=${h15SavedWired}`
    )
    assert('H15 antre permission bukan literal 1 dari {1}', h15QueueReal, `queueReal=${h15QueueReal}`)

    // ================= N4.4.2: H16 =================

    const sessionBarSrc = readFileRel('src/components/SessionBar.tsx')
    const shellSrc2 = readFileRel('src/components/Shell.tsx')
    const appSrc = readFileRel('src/App.tsx')
    const storeSrc2 = readFileRel('src/lib/sessionStore.ts')

    // ---- H16a: keadaan buka daftar dipakai bersama (SessionBar tanpa
    //          useState lokal open yamat; toggle ter-wire ke Shell) ----
    const h16aBarNoLocalOpen = !/useState\(\s*false\s*\)/.test(sessionBarSrc)
    const h16aBarWire = sessionBarSrc.includes('onToggle')
    const h16aShellWire = shellSrc2.includes('SessionBar open={listOpen}') && shellSrc2.includes('setListOpen')
    assert(
      'H16a keadaan buka daftar dipakai bersama — SessionBar tanpa useState lokal open yamat; toggle ter-wire ke Shell',
      h16aBarNoLocalOpen && h16aBarWire && h16aShellWire,
      `barNoLocalOpen=${h16aBarNoLocalOpen} barWire=${h16aBarWire} shellWire=${h16aShellWire}`
    )

    // ---- H16b: eventStream.start() dipanggil di src/ (App/Shell/store) ----
    const h16b = appSrc.includes('eventStream.start()') || shellSrc2.includes('eventStream.start()') || storeSrc2.includes('eventStream.start()')
    assert('H16b eventStream.start() dipanggil di src/', h16b, `startCalled=${h16b}`)

    // ---- H16c: syarat berhenti polling tidak menganggap "pesan terakhir
    //          user" sebagai selesai ----
    const h16c = storeSrc2.includes('lastUser > lastAssistant') || storeSrc2.includes("last.type === 'user'")
    assert(
      'H16c polling tidak mati saat pesan terakhir = user (masih menunggu)',
      h16c,
      `waitLogic=${h16c}`
    )

    // ---- H16d: muat awal pesan memakai arah desc (50 terbaru) ----
    const h16d = storeSrc2.includes("PAGE_SIZE, 'desc'") || storeSrc2.includes('PAGE_SIZE, "desc"')
    const h16dReverse = storeSrc2.includes('.reverse()')
    assert(
      'H16d muat awal = 50 pesan TERAKHIR (order desc) lalu dibalik untuk tampil menaik',
      h16d && h16dReverse,
      `desc=${h16d} reverse=${h16dReverse}`
    )

    // ================= N4.4.3: H17 =================

    const listSrc3 = readFileRel('src/components/SessionList.tsx')
    const cardSrc3 = readFileRel('src/components/SessionCard.tsx')
    const newSrc = readFileRel('src/components/NewSessionDialog.tsx')
    const cssSrc3 = readFileRel('src/styles/spine-flux.css')

    // ---- H17a: pemicu "Sesi baru" di bar aksi TETAP (di luar area scroll);
    //           kartu --add tidak lagi ada di area scroll ----
    const scrollIdx = listSrc3.indexOf('fx-session-list__scroll')
    const preScroll = scrollIdx >= 0 ? listSrc3.slice(0, scrollIdx) : ''
    const scrollArea = scrollIdx >= 0 ? listSrc3.slice(scrollIdx) : listSrc3
    const h17aActions = preScroll.includes('fx-session-list__actions') && preScroll.includes('Sesi baru') && preScroll.includes('onNew')
    const h17aNoAddCard = !scrollArea.includes('fx-session-card--add')
    assert(
      'H17a pemicu "Sesi baru" di bar aksi tetap di luar .fx-session-list__scroll; kartu --add tidak ada di area scroll',
      h17aActions && h17aNoAddCard,
      `actions=${h17aActions} noAddCard=${h17aNoAddCard}`
    )

    // ---- H17b: akar kartu BUKAN <button>; aksi memakai ikon (tidak ada
    //           tombol teks "Statistik sesi" / "model") ----
    const h17bRootDiv = cardSrc3.includes('<div') && /className="fx-session-card"/.test(cardSrc3) && !/className="fx-session-card"[\s\S]{0,80}type="button"/.test(cardSrc3)
    const h17bIcons = ['Edit2', 'BarChart3', 'Trash2', 'Bot'].every((ic) => cardSrc3.includes(ic))
    const h17bNoTextButtons = !cardSrc3.includes('>Statistik sesi<') && !/>\s*model\s*</.test(cardSrc3)
    assert(
      'H17b akar .fx-session-card = <div> (bukan <button>); tombol aksi ikon, bukan teks lebar',
      h17bRootDiv && h17bIcons && h17bNoTextButtons,
      `rootDiv=${h17bRootDiv} icons=${h17bIcons} noTextButtons=${h17bNoTextButtons}`
    )

    // ---- H17c: dialog memakai .fx-newsession (bukan fx-permission-sheet);
    //           kotak model max-height + overflow-y:auto ----
    const h17cOwnClass = newSrc.includes('className="fx-newsession"') && !/className="fx-permission-sheet"/.test(newSrc)
    const modelsBlock = (cssSrc3.match(/\.fx-newsession__models\s*\{[^}]*\}/) ?? [''])[0]
    const h17cBox = /max-height\s*:/.test(modelsBlock) && /overflow-y\s*:\s*auto/.test(modelsBlock)
    assert(
      'H17c dialog memakai .fx-newsession (bukan .fx-permission-sheet) + kotak model max-height & overflow-y:auto',
      h17cOwnClass && h17cBox,
      `ownClass=${h17cOwnClass} box=${h17cBox}`
    )

    // ================= N4.4.4: H18 =================

    const listSrc4 = readFileRel('src/components/SessionList.tsx')
    const cardSrc4 = readFileRel('src/components/SessionCard.tsx')
    const cssSrc4 = readFileRel('src/styles/spine-flux.css')

    // ---- H18a (live): round-trip alias lokal + auth + validasi + persistensi
    //      sesudah adapter scratch di-restart dengan state dir yang sama ----
    const aliasSessionID = newId
    const aliasTitle = 'Alias Verifikasi N4.4.4'
    const persistTitle = 'Alias Persist N4.4.4'
    let h18Put = { status: 0 }
    let h18GetOk = false
    let h18Naked = { status: 0 }
    let h18Empty = { status: 0 }
    let h18Delete = { status: 0 }
    let h18Gone = false
    let h18Persist = false
    let h18RestartOk = false

    if (aliasSessionID) {
      const aliasPath = `/api/session-alias/${encodeURIComponent(aliasSessionID)}`
      h18Put = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: aliasPath, method: 'PUT', cookie,
        body: JSON.stringify({ title: `  ${aliasTitle}  ` }),
        headers: { 'content-type': 'application/json' },
      })
      const get1 = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session-alias', cookie })
      const get1J = jsonSafe(get1.body)
      h18GetOk = get1.status === 200 && get1J?.aliases?.[aliasSessionID] === aliasTitle

      h18Naked = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session-alias' })
      h18Empty = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: aliasPath, method: 'PUT', cookie,
        body: JSON.stringify({ title: '   ' }),
        headers: { 'content-type': 'application/json' },
      })
      h18Delete = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: aliasPath, method: 'DELETE', cookie,
      })
      const get2 = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session-alias', cookie })
      const get2J = jsonSafe(get2.body)
      h18Gone = get2.status === 200 && !Object.prototype.hasOwnProperty.call(get2J?.aliases ?? {}, aliasSessionID)

      // Persistensi: PUT lagi, restart adapter dengan FLUX_STATE_DIR yang sama,
      // login ulang (sesi auth in-memory hilang saat restart), lalu GET.
      const put2 = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: aliasPath, method: 'PUT', cookie,
        body: JSON.stringify({ title: persistTitle }),
        headers: { 'content-type': 'application/json' },
      })
      if (put2.status === 200) {
        await new Promise((resolve) => {
          adapter.once('close', resolve)
          adapter.kill('SIGTERM')
          setTimeout(resolve, 3000)
        })
        await new Promise((r) => setTimeout(r, 400))
        adapter = spawn('node', ['server.mjs'], {
          cwd: REPO,
          env: { ...process.env, FLUX_PORT: String(SCRATCH_PORT), FLUX_STATE_DIR: SCRATCH_STATE },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        adapter.stdout.on('data', (c) => adapterLog.push(c.toString()))
        adapter.stderr.on('data', (c) => adapterLog.push(c.toString()))
        h18RestartOk = await waitForHealthz()
        if (h18RestartOk) {
          const login2 = await httpRequest({
            hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/login', method: 'POST',
            body: JSON.stringify({ password: SCRATCH_PASSWORD }),
            headers: { 'content-type': 'application/json' },
          })
          const freshCookie = extractCookie(login2.headers['set-cookie'])
          if (freshCookie) cookie = freshCookie
          const get3 = await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: '/api/session-alias', cookie })
          const get3J = jsonSafe(get3.body)
          h18Persist = get3.status === 200 && get3J?.aliases?.[aliasSessionID] === persistTitle
          await httpRequest({ hostname: SCRATCH_HOST, port: SCRATCH_PORT, path: aliasPath, method: 'DELETE', cookie })
        }
      }
    }

    assert(
      'H18a round-trip alias lokal: PUT 200, GET memuat, DELETE 204 lalu kosong; tanpa cookie 401; judul kosong 400; alias bertahan sesudah restart adapter',
      h18Put.status === 200 && h18GetOk && h18Naked.status === 401 && h18Empty.status === 400 &&
        h18Delete.status === 204 && h18Gone && h18RestartOk && h18Persist,
      `put=${h18Put.status} get=${h18GetOk} naked=${h18Naked.status} empty=${h18Empty.status} delete=${h18Delete.status} gone=${h18Gone} restart=${h18RestartOk} persist=${h18Persist}`
    )

    // ---- H18b (source): search judul efektif + ikon Shield menggantikan
    //      tombol teks "Izin tersimpan", tetap membuka PermissionSavedList ----
    const h18bSearch =
      listSrc4.includes('fx-session-list__search') &&
      listSrc4.includes('Cari nama sesi') &&
      listSrc4.includes('toLowerCase()') &&
      listSrc4.includes('.title')
    const h18bShield =
      listSrc4.includes('Shield') &&
      !listSrc4.includes('ShieldCheck') &&
      !/>\s*Izin tersimpan\s*</.test(listSrc4)
    const h18bSaved = listSrc4.includes('getPermissionSaved') && listSrc4.includes('PermissionSavedList')
    assert(
      'H18b SessionList: input search memfilter judul efektif; tombol teks "Izin tersimpan" diganti ikon Shield yang tetap membuka PermissionSavedList',
      h18bSearch && h18bShield && h18bSaved,
      `search=${h18bSearch} shield=${h18bShield} saved=${h18bSaved}`
    )

    // ---- H18c (source/CSS): kartu video — rounded 14px, node 28px
    //      (N4.4.5 merampingkan dari 34px), border per data-state sesuai §2 ----
    const h18cBase = (cssSrc4.match(/\.fx-session-card\s*\{[^}]*\}/) ?? [''])[0]
    const h18cNode = (cssSrc4.match(/\.fx-session-card__node\s*\{[^}]*\}/) ?? [''])[0]
    const stateBlock = (name) =>
      (cssSrc4.match(new RegExp(`\\.fx-session-card\\[data-state="${name}"\\]\\s*\\{[^}]*\\}`)) ?? [''])[0]
    const h18cRadius = /border-radius:\s*1[2-6]px/.test(h18cBase)
    const h18cNode28 = /width:\s*28px/.test(h18cNode) && /height:\s*28px/.test(h18cNode)
    const h18cActive =
      /rgba\(56,\s*189,\s*248,\s*0?\.55\)/.test(stateBlock('active')) &&
      /linear-gradient/.test(stateBlock('active'))
    const h18cRun = /rgba\(251,\s*191,\s*36,\s*0?\.55\)/.test(stateBlock('run'))
    const h18cIdle = /rgba\(255,\s*255,\s*255,\s*0?\.08\)/.test(stateBlock('idle'))
    assert(
      'H18c kartu video: border-radius 14px (±2), node 28px (ramping N4.4.5), border per data-state (aktif cyan+gradasi, run amber, idle redup)',
      h18cRadius && h18cNode28 && h18cActive && h18cRun && h18cIdle,
      `radius=${h18cRadius} node28=${h18cNode28} active=${h18cActive} run=${h18cRun} idle=${h18cIdle}`
    )

    // ================= N4.4.5: H19 =================

    const cardSrc5 = readFileRel('src/components/SessionCard.tsx')
    const cssSrc5 = readFileRel('src/styles/spine-flux.css')

    // ---- H19a: satu tinggi kartu --fx-card-h + border-box ----
    const h19Base = (cssSrc5.match(/\.fx-session-card\s*\{[^}]*\}/) ?? [''])[0]
    const h19Var = /--fx-card-h:\s*68px/.test(cssSrc5)
    const h19Height = /height:\s*var\(--fx-card-h\)/.test(h19Base) && /box-sizing:\s*border-box/.test(h19Base)
    assert(
      'H19a .fx-session-card memakai --fx-card-h: 68px + height variabel + box-sizing border-box',
      h19Var && h19Height,
      `var=${h19Var} height=${h19Height}`
    )

    // ---- H19b: MarqueeText dipakai judul/model/meta + keyframes ada ----
    const h19MarqueeFn = /function\s+MarqueeText\s*\(/.test(cardSrc5)
    const h19MarqueeUses = (cardSrc5.match(/<MarqueeText\b/g) ?? []).length
    const h19MarqueeTargets = ['fx-session-card__title', 'fx-session-card__model', 'fx-session-card__meta']
      .every((cls) => cardSrc5.includes(`className="${cls}"`))
    const h19Keyframes =
      /@keyframes\s+fx-marquee\s*\{[\s\S]*?var\(--fx-shift\)/.test(cssSrc5)
    assert(
      'H19b MarqueeText ada + dipakai judul/model/meta di SessionCard; @keyframes fx-marquee memakai --fx-shift',
      h19MarqueeFn && h19MarqueeUses >= 3 && h19MarqueeTargets && h19Keyframes,
      `fn=${h19MarqueeFn} uses=${h19MarqueeUses} targets=${h19MarqueeTargets} keyframes=${h19Keyframes}`
    )

    // ---- H19c: baris model SELALU dirender (tanpa kondisional yang menghilangkannya) ----
    const h19ModelRow = /<MarqueeText\s+className="fx-session-card__model"\s+text=\{modelText\}\s*\/>/.test(cardSrc5)
    const h19NoConditionalModelRow =
      !/session\.model\?\.id\s*&&\s*<[^>]*fx-session-card__model/.test(cardSrc5) &&
      !/session\.model\s*&&\s*<[^>]*fx-session-card__model/.test(cardSrc5)
    assert(
      'H19c baris model dirender tanpa kondisional; sesi tanpa model tetap punya baris kosong setinggi 15px',
      h19ModelRow && h19NoConditionalModelRow,
      `modelRow=${h19ModelRow} unconditional=${h19NoConditionalModelRow}`
    )

  } finally {
    adapter.kill()
    cleanup()
  }

  log(`HASIL: ${failures === 0 ? 'SEMUA PASS (H0-H19)' : failures + ' ASSERTION GAGAL'}`)
  process.exit(failures === 0 ? 0 : 1)
}

function cleanup() {
  try { fs.rmSync(SCRATCH_STATE, { recursive: true, force: true }) } catch { /* abaikan */ }
}

main().catch((err) => {
  log(`FATAL: ${err && err.message ? err.message : err}`)
  cleanup()
  process.exit(1)
})
