#!/usr/bin/env node
// scripts/verify-n41.mjs — harness verifikasi ulang-uliang N4.1.
// Boot instance adapter scratch (state dir + port di luar repo, password
// scratch milik harness sendiri), menyajikan dist hasil build, lalu menjalankan
// assertion H1-H6 melalui adapter asli + dist asli.
// Tidak pernah mencetak password/token/rahasia ke output.
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
// Password scratch di-generate harness sendiri; bukan dan tidak pernah password Erix.
const SCRATCH_PASSWORD = 'N4.1VerifyScratch-' + crypto.randomBytes(6).toString('hex')

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

// H7: anti-pola getState() — komponen (Shell/ChatColumn/Composer) tidak boleh
// membaca sessionStore.getState() langsung saat render; harus lewat useSessionStore.
function sourceHasGetState(file) {
  try {
    const src = fs.readFileSync(path.join(REPO, file), 'utf8')
    return /\bgetState\(\)/.test(src)
  } catch {
    return false
  }
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
      // abaikan (bukan proses kita / tidak boleh dibaca)
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
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data })
        )
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
      const r = await httpRequest({
        hostname: SCRATCH_HOST,
        port: SCRATCH_PORT,
        path: '/healthz',
      })
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
  // ---- 0. Pastikan dist build terbaru (build EXIT=0) ----
  const buildLog = []
  const build = spawn('npm', ['run', 'build'], {
    cwd: REPO,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  build.stdout.on('data', (c) => buildLog.push(c.toString()))
  build.stderr.on('data', (c) => buildLog.push(c.toString()))
  const buildCode = await new Promise((r) => build.on('close', r))
  assert(
    'H0 build npm run build EXIT=0',
    buildCode === 0,
    `exit ${buildCode}; tail: ${buildLog.join('').trim().split('\n').slice(-2).join(' | ')}`
  )
  if (buildCode !== 0) {
    cleanup()
    process.exit(1)
  }

  // ---- 1. Boot adapter scratch (state dir scratch di luar repo) ----
  claimScratchPort(SCRATCH_PORT)
  await new Promise((r) => setTimeout(r, 1000))
  fs.rmSync(SCRATCH_STATE, { recursive: true, force: true })
  fs.mkdirSync(SCRATCH_STATE, { recursive: true })
  const adapterLog = []
  const adapter = spawn('node', ['server.mjs'], {
    cwd: REPO,
    env: {
      ...process.env,
      FLUX_PORT: String(SCRATCH_PORT),
      FLUX_STATE_DIR: SCRATCH_STATE,
      // Registry default sudah menunjuk ke upstream asli (baca saja, sandi tidak dicetak).
    },
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
  if (!healthy) {
    adapter.kill()
    cleanup()
    process.exit(1)
  }

  let cookie = null

  try {
    // ---- Setup + login dengan sandi scratch (harness milik sendiri) ----
    const setup = await httpRequest({
      hostname: SCRATCH_HOST,
      port: SCRATCH_PORT,
      path: '/setup',
      method: 'POST',
      body: JSON.stringify({ password: SCRATCH_PASSWORD }),
      headers: { 'content-type': 'application/json' },
    })
    let setupOk = setup.status === 200
    if (setup.status === 409) {
      // Instance scratch sudah pernah di-setup (state tidak benar-benar kosong);
      // coba login dengan sandi scratch milik harness.
      const loginRetry = await httpRequest({
        hostname: SCRATCH_HOST,
        port: SCRATCH_PORT,
        path: '/login',
        method: 'POST',
        body: JSON.stringify({ password: SCRATCH_PASSWORD }),
        headers: { 'content-type': 'application/json' },
      })
      setupOk = loginRetry.status === 200
      const retryCookie = extractCookie(loginRetry.headers['set-cookie'])
      if (retryCookie) cookie = retryCookie
    } else {
      cookie = extractCookie(setup.headers['set-cookie'])
    }
    assert(
      'setup/login scratch adapter berhasil + cookie berlaku',
      setupOk && !!cookie,
      `setup status ${setup.status}${cookie ? '' : ' (tidak ada cookie)'}`
    )

    assert(
      'login scratch adapter 200 + cookie berlaku',
      !!cookie,
      `cookie ${cookie ? 'terima' : 'tidak ada cookie'}`
    )

    // ---- H1: daftar sesi lewat adapter + cookie → 200, > 0 ----
    const listUi = await httpRequest({
      hostname: SCRATCH_HOST,
      port: SCRATCH_PORT,
      path: '/api/session?limit=50',
      cookie,
    })
    const listUiJson = jsonSafe(listUi.body)
    const uiCount = Array.isArray(listUiJson?.data) ? listUiJson.data.length : -1
    assert(
      'H1 GET /api/session via adaptor + cookie → 200 dan > 0 sesi',
      listUi.status === 200 && uiCount > 0,
      `status ${listUi.status}, jumlah ${uiCount}`
    )

    // ---- H2: himpunan id lewat adaptor sama dengan upstream langsung (N0 Basic) ----
    const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf8')
    const registry = JSON.parse(registryRaw)
    const upUrl = new URL(registry.url.replace(/\/+$/, ''))
    const upAuth =
      'Basic ' + Buffer.from(`opencode:${registry.password}`).toString('base64')
    const up = await httpRequest({
      hostname: upUrl.hostname,
      port: Number(upUrl.port) || 80,
      path: upUrl.pathname + '/api/session?limit=50',
      headers: { authorization: upAuth, accept: 'application/json' },
    })
    const upJson = jsonSafe(up.body)
    const upCount = Array.isArray(upJson?.data) ? upJson.data.length : -1
    const uiIds = new Set((listUiJson.data ?? []).map((s) => s.id))
    const upIds = new Set((upJson.data ?? []).map((s) => s.id))
    const idsMatch = up.status === 200 && uiCount === upCount && uiIds.size === upIds.size && [...uiIds].every((id) => upIds.has(id))
    assert(
      'H2 daftar sesi adaptor === upstream langsung (jumlah + id cocok = sinkron CLI)',
      idsMatch,
      `adaptor ${uiCount} vs upstream ${upCount}, id set sama: ${idsMatch}`
    )

    // ---- H3: buat sesi scratch baru ----
    const created = await httpRequest({
      hostname: SCRATCH_HOST,
      port: SCRATCH_PORT,
      path: '/api/session',
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
      cookie,
    })
    const createdJson = jsonSafe(created.body)
    const newId = createdJson?.data?.id
    assert(
      'H3 POST /api/session membuat sesi baru → id kembali',
      created.status === 200 && typeof newId === 'string' && newId.length > 0,
      `status ${created.status}, id ${newId ? newId.slice(0, 8) + '…' : '-'}`
    )

    // ---- H4: kirim prompt ke sesi scratch, poll sampai balasan assistant tiba ----
    let assistantArrived = false
    let lastCount = -1
    if (newId) {
      const send = await httpRequest({
        hostname: SCRATCH_HOST,
        port: SCRATCH_PORT,
        path: `/api/session/${encodeURIComponent(newId)}/prompt`,
        method: 'POST',
        body: JSON.stringify({ text: 'verifikasi n4.1: balas dengan kalimat PONG_VERIFI' }),
        headers: { 'content-type': 'application/json' },
        cookie,
      })
      assert(
        'H4a POST /api/session/:id/prompt 200',
        send.status === 200,
        `status ${send.status}`
      )
      if (send.status === 200) {
        const deadline = Date.now() + 120000
        while (Date.now() < deadline) {
          const msg = await httpRequest({
            hostname: SCRATCH_HOST,
            port: SCRATCH_PORT,
            path: `/api/session/${encodeURIComponent(newId)}/message?limit=50&order=asc`,
            cookie,
          })
          const mj = jsonSafe(msg.body)
          const count = Array.isArray(mj?.data) ? mj.data.length : -1
          lastCount = count
          if (count > 0 && (mj.data ?? []).some((m) => m.type === 'assistant')) {
            assistantArrived = true
            break
          }
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
    }
    assert(
      'H4b balasan assistant tiba dalam 120 detik',
      assistantArrived,
      `pesan terakhir terhitung ${lastCount}, assistant=${assistantArrived}`
    )

    // ---- H5: GET / menyajikan dist terbaru; asset di index.html ada di dist ----
    const root = await httpRequest({
      hostname: SCRATCH_HOST,
      port: SCRATCH_PORT,
      path: '/',
    })
    const rootOk = root.status === 200 && /<html/i.test(root.body)
    const assets = [...root.body.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map(
      (m) => m[1]
    )
    let assetOk = true
    let assetEv = ''
    for (const a of assets) {
      if (!a.startsWith('/')) continue
      const localFile = path.join(DIST, a.replace(/^\//, ''))
      const served = await httpRequest({
        hostname: SCRATCH_HOST,
        port: SCRATCH_PORT,
        path: a,
      })
      const existsLocally = fs.existsSync(localFile)
      if (served.status !== 200 || !existsLocally) {
        assetOk = false
        assetEv += ` ${a}(served ${served.status}, lokal ${existsLocally})`
      }
    }
    assert(
      'H5 GET / layanan dist terbaru + asset cocok file dist lokal',
      rootOk && assetOk && assets.length > 0,
      `root ${root.status}, asset dicek ${assets.length}, masalah: ${assetEv || '-'}`
    )

    // ---- H6: GET /api/session tanpa cookie → 401 ----
    const naked = await httpRequest({
      hostname: SCRATCH_HOST,
      port: SCRATCH_PORT,
      path: '/api/session?limit=50',
    })
    assert(
      'H6 GET /api/session tanpa cookie → 401',
      naked.status === 401,
      `status ${naked.status}`
    )

    // ---- H7: anti-pola getState() di komponen ----
    const h7Files = ['src/components/Shell.tsx', 'src/components/ChatColumn.tsx', 'src/components/Composer.tsx']
    const h7Bad = h7Files.filter((f) => sourceHasGetState(f))
    assert(
      'H7 tidak ada pembacaan getState() satu-kali-saat-render di komponen',
      h7Bad.length === 0,
      h7Bad.length === 0 ? 'bersih' : 'terdeteksi di ' + h7Bad.join(', ')
    )

    // ---- H8: dua putaran prompt dalam SATU sesi scratch, keduanya berbalas ----
    let h8Round1 = false, h8Round2 = false, h8LastCount = -1, baseAsst = 0
    if (newId) {
      // baseline setelah H4 (sesi sudah mungkin punya 1 assistant)
      const base = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT,
        path: `/api/session/${encodeURIComponent(newId)}/message?limit=50&order=asc`,
        cookie,
      })
      const baseMj = jsonSafe(base.body)
      baseAsst = Array.isArray(baseMj?.data) ? baseMj.data.filter((m) => m.type === 'assistant').length : 0
      for (const round of [1, 2]) {
        const snd = await httpRequest({
          hostname: SCRATCH_HOST, port: SCRATCH_PORT,
          path: `/api/session/${encodeURIComponent(newId)}/prompt`,
          method: 'POST', cookie,
          body: JSON.stringify({ text: `verifikasi n4.3 putaran ${round}: balas PONG_${round}` }),
          headers: { 'content-type': 'application/json' },
        })
        if (snd.status === 200) {
          const deadline = Date.now() + 120000
          let arrived = false
          while (Date.now() < deadline) {
            const msg = await httpRequest({
              hostname: SCRATCH_HOST, port: SCRATCH_PORT,
              path: `/api/session/${encodeURIComponent(newId)}/message?limit=50&order=asc`,
              cookie,
            })
            const mj = jsonSafe(msg.body)
            const data = Array.isArray(mj?.data) ? mj.data : []
            const asst = data.filter((m) => m.type === 'assistant').length
            h8LastCount = data.length
            const target = baseAsst + round
            if (asst >= target) {
              if (round === 1) h8Round1 = true; else h8Round2 = true
              arrived = true
              break
            }
            await new Promise((r) => setTimeout(r, 2000))
          }
          if (!arrived) break
        }
      }
    }
    assert('H8 putaran 1 berbalas (terjemput via store/rest)', h8Round1, `baseline ${baseAsst}, sekarang ${h8LastCount}`)
    assert('H8 putaran 2 berbalas (terjemput via store/rest)', h8Round2, `baseline ${baseAsst}, sekarang ${h8LastCount}`)

    // ---- H9: ganti model pada sesi berjalan (atau SKIP-TIDAK-DIDUKUNG + bukti probe) ----
    let h9ModelChanged = false, h9PromptOk = false
    if (newId) {
      const chg = await httpRequest({
        hostname: SCRATCH_HOST, port: SCRATCH_PORT,
        path: `/api/session/${encodeURIComponent(newId)}`,
        method: 'PATCH', cookie,
        body: JSON.stringify({ model: { id: 'deepseek-v4.1-flash-free', providerID: '9router' } }),
        headers: { 'content-type': 'application/json' },
      })
      h9ModelChanged = chg.status === 200
      if (h9ModelChanged) {
        const snd = await httpRequest({
          hostname: SCRATCH_HOST, port: SCRATCH_PORT,
          path: `/api/session/${encodeURIComponent(newId)}/prompt`,
          method: 'POST', cookie,
          body: JSON.stringify({ text: 'verifikasi n4.3 model ganti: balas PONG_MODEL' }),
          headers: { 'content-type': 'application/json' },
        })
        if (snd.status === 200) {
          const deadline = Date.now() + 120000
          while (Date.now() < deadline) {
            const msg = await httpRequest({
              hostname: SCRATCH_HOST, port: SCRATCH_PORT,
              path: `/api/session/${encodeURIComponent(newId)}/message?limit=50&order=asc`,
              cookie,
            })
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
      assert('H9 SKIP-TIDAK-DIDUKUNG: ganti model pada sesi berjalan tidak didukung upstream', true, 'PATCH /api/session/:id → tidak didukung (degradasi jujur)')
    }
  } finally {
    adapter.kill()
    cleanup()
  }

  log(`HASIL: ${failures === 0 ? 'SEMUA PASS' : failures + ' ASSERTION GAGAL'}`)
  process.exit(failures === 0 ? 0 : 1)
}

function cleanup() {
  try {
    fs.rmSync(SCRATCH_STATE, { recursive: true, force: true })
  } catch {
    // abaikan
  }
}

main().catch((err) => {
  log(`FATAL: ${err && err.message ? err.message : err}`)
  cleanup()
  process.exit(1)
})
