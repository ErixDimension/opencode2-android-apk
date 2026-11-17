// Store kredensial adapter flux-webui (password login milik flux-webui sendiri).
// Plaintext password tidak pernah disimpan/dicetak; hanya salt + hash scrypt.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const STATE_DIR = process.env.FLUX_STATE_DIR || path.join(os.homedir(), '.local/state/flux-webui')
export const CREDENTIALS_FILE = path.join(STATE_DIR, 'credentials.json')

export function readStore() {
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (
      !data ||
      data.version !== 1 ||
      data.algo !== 'scrypt' ||
      typeof data.salt !== 'string' ||
      typeof data.hash !== 'string' ||
      typeof data.epoch !== 'number'
    ) {
      return null
    }
    return data
  } catch {
    return null
  }
}

export function getAuthState() {
  return readStore() ? 'ready' : 'setup-required'
}

export function getEpoch() {
  return readStore()?.epoch ?? 0
}

export function validatePasswordShape(password) {
  if (typeof password !== 'string' || password.length === 0) return 'PASSWORD_INVALID'
  if (password.length < 8) return 'PASSWORD_TOO_SHORT'
  if (password.length > 128) return 'PASSWORD_INVALID'
  return null
}

function derive(password, salt) {
  return crypto.scryptSync(password, salt, 64)
}

function writeAtomic(data) {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  try {
    fs.chmodSync(STATE_DIR, 0o700)
  } catch {
    // abaikan bila filesystem tidak mendukung
  }
  const tmp = path.join(
    STATE_DIR,
    `.credentials.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`,
  )
  try {
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 })
    fs.renameSync(tmp, CREDENTIALS_FILE)
    try {
      fs.chmodSync(CREDENTIALS_FILE, 0o600)
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

export function createStore(password) {
  const salt = crypto.randomBytes(16)
  const hash = derive(password, salt)
  const data = {
    version: 1,
    algo: 'scrypt',
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
    epoch: 1,
    updatedAt: new Date().toISOString(),
  }
  writeAtomic(data)
  return data
}

export function verifyPassword(password) {
  if (typeof password !== 'string') return false
  const store = readStore()
  if (!store) return false
  try {
    const salt = Buffer.from(store.salt, 'hex')
    const expected = Buffer.from(store.hash, 'hex')
    if (salt.length === 0 || expected.length !== 64) return false
    const actual = derive(password, salt)
    return crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function changePassword(currentPassword, newPassword) {
  if (!verifyPassword(currentPassword)) return null
  const store = readStore()
  if (!store) return null
  const salt = crypto.randomBytes(16)
  const hash = derive(newPassword, salt)
  const data = {
    version: 1,
    algo: 'scrypt',
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
    epoch: store.epoch + 1,
    updatedAt: new Date().toISOString(),
  }
  writeAtomic(data)
  return data
}
