// Alias judul sesi lokal flux-webui (N4.4.4).
// Upstream TIDAK punya endpoint ganti judul (PATCH/PUT/POST → 404, dibuktikan
// discovery N4.4). Alias di sini adalah tampilan milik flux-webui sendiri:
// judul upstream/CLI tidak berubah. Berkas state di samping credentials.json,
// ditulis atomik dengan pola yang sama.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { STATE_DIR } from './credentials.mjs'

export const ALIASES_FILE = path.join(STATE_DIR, 'session-aliases.json')
const MAX_TITLE = 80
const MAX_ID = 200

// ID sesi upstream berbentuk `ses_...`; batasi ke karakter aman path/JSON.
export function isValidSessionID(id) {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= MAX_ID &&
    /^[A-Za-z0-9._-]+$/.test(id)
  )
}

// Judul di-trim; valid 1–80 karakter. Mengembalikan judul bersih atau null.
export function normalizeTitle(title) {
  if (typeof title !== 'string') return null
  const trimmed = title.trim()
  if (trimmed.length < 1 || trimmed.length > MAX_TITLE) return null
  return trimmed
}

export function readAliases() {
  let data
  try {
    data = JSON.parse(fs.readFileSync(ALIASES_FILE, 'utf8'))
  } catch {
    return {}
  }
  if (
    !data ||
    data.version !== 1 ||
    typeof data.aliases !== 'object' ||
    data.aliases === null ||
    Array.isArray(data.aliases)
  ) {
    return {}
  }
  const out = Object.create(null)
  for (const [id, title] of Object.entries(data.aliases)) {
    const clean = normalizeTitle(title)
    if (isValidSessionID(id) && clean) out[id] = clean
  }
  return out
}

function writeAtomic(aliases) {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  try {
    fs.chmodSync(STATE_DIR, 0o700)
  } catch {
    // abaikan bila filesystem tidak mendukung
  }
  const tmp = path.join(
    STATE_DIR,
    `.session-aliases.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`,
  )
  try {
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, aliases }), { mode: 0o600 })
    fs.renameSync(tmp, ALIASES_FILE)
    try {
      fs.chmodSync(ALIASES_FILE, 0o600)
    } catch {
      // abaikan
    }
  } catch (err) {
    try {
      fs.unlinkSync(tmp)
    } catch {
      // abaikan
    }
    throw err
  }
}

export function setAlias(sessionID, title) {
  if (!isValidSessionID(sessionID)) return null
  const clean = normalizeTitle(title)
  if (!clean) return null
  const aliases = readAliases()
  aliases[sessionID] = clean
  writeAtomic(aliases)
  return clean
}

export function deleteAlias(sessionID) {
  if (!isValidSessionID(sessionID)) return false
  const aliases = readAliases()
  if (!Object.prototype.hasOwnProperty.call(aliases, sessionID)) return false
  delete aliases[sessionID]
  writeAtomic(aliases)
  return true
}
