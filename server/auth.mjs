// Auth adapter: sesi in-memory (epoch-bound), lockout per-IP.
// Password user→adapter berasal dari credentials.json milik flux-webui sendiri.
import crypto from 'node:crypto'
import { getEpoch } from './credentials.mjs'

export const COOKIE_NAME = 'flux_session'
export const COOKIE_MAX_AGE = 43200 // 12 jam
export const COOKIE_MAX_AGE_MS = COOKIE_MAX_AGE * 1000

const IDLE_MS = 12 * 60 * 60 * 1000
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000
const RENEW_AFTER_MS = 60 * 60 * 1000
const MAX_SESSIONS = 32

const LOGIN_MAX_FAILURES = 5
const LOGIN_LOCK_MS = 60 * 1000

const sessions = new Map() // token -> { createdAt, lastSeenAt, issuedAt, epoch }
const failures = new Map() // ip -> { count, lockUntil }

export function parseCookies(header) {
  const out = Object.create(null)
  if (!header) return out
  for (const part of header.split(';')) {
    const at = part.indexOf('=')
    if (at < 0) continue
    const k = part.slice(0, at).trim()
    if (!k) continue
    out[k] = part.slice(at + 1).trim()
  }
  return out
}

export function cookieFor(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`
}

export function clearedCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
}

export function createSession() {
  const token = crypto.randomBytes(32).toString('base64url')
  const now = Date.now()
  sessions.set(token, {
    createdAt: now,
    lastSeenAt: now,
    issuedAt: now,
    epoch: getEpoch(),
  })
  while (sessions.size > MAX_SESSIONS) {
    let oldestToken = null
    let oldestAt = Infinity
    for (const [t, s] of sessions) {
      if (s.createdAt < oldestAt) {
        oldestAt = s.createdAt
        oldestToken = t
      }
    }
    sessions.delete(oldestToken)
  }
  return token
}

export function validateSession(token) {
  if (!token) return null
  const sess = sessions.get(token)
  if (!sess) return null
  const now = Date.now()
  if (now - sess.createdAt > ABSOLUTE_MS || now - sess.lastSeenAt > IDLE_MS) {
    sessions.delete(token)
    return null
  }
  if (sess.epoch !== getEpoch()) {
    sessions.delete(token)
    return null
  }
  sess.lastSeenAt = now
  let renew = false
  if (now - sess.issuedAt > RENEW_AFTER_MS) {
    sess.issuedAt = now
    renew = true
  }
  return { renew }
}

export function destroySession(token) {
  if (token) sessions.delete(token)
}

export function invalidateAllSessions() {
  sessions.clear()
}

export function isLocked(ip) {
  const entry = failures.get(ip)
  if (!entry) return false
  if (entry.lockUntil && entry.lockUntil > Date.now()) return true
  if (entry.lockUntil) failures.delete(ip)
  return false
}

export function recordFailure(ip) {
  const now = Date.now()
  const entry = failures.get(ip) ?? { count: 0, lockUntil: 0 }
  if (entry.lockUntil && entry.lockUntil <= now) {
    entry.count = 0
    entry.lockUntil = 0
  }
  entry.count += 1
  if (entry.count >= LOGIN_MAX_FAILURES) {
    entry.lockUntil = now + LOGIN_LOCK_MS
    entry.count = 0
  }
  failures.set(ip, entry)
}

export function clearFailures(ip) {
  failures.delete(ip)
}

export function retryAfterSeconds() {
  return Math.ceil(LOGIN_LOCK_MS / 1000)
}

setInterval(() => {
  const now = Date.now()
  for (const [token, sess] of sessions) {
    if (now - sess.createdAt > ABSOLUTE_MS || now - sess.lastSeenAt > IDLE_MS) {
      sessions.delete(token)
    }
  }
  for (const [ip, entry] of failures) {
    if (entry.lockUntil && entry.lockUntil <= now && entry.count === 0) failures.delete(ip)
  }
}, 60 * 1000).unref()
