// Kebijakan FS: root yang diizinkan, alias, dan blokir direktori privat Android.
// Data kebijakan direferensikan dari adapter lama; implementasi baru.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT_DEFS = [
  { id: 'home', path: path.join(os.homedir()) },
  { id: 'shared', path: '/storage/emulated/0' },
  {
    id: 'ubuntu-proot',
    path: '/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs',
  },
]

const BLOCKED_SHARED = [
  '/storage/emulated/0/Android/data',
  '/storage/emulated/0/Android/obb',
  '/storage/emulated/0/Android/media',
]

let rootsCache = null
let blockedCache = null

function canon(p) {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

function roots() {
  if (rootsCache) return rootsCache
  const out = []
  for (const def of ROOT_DEFS) {
    const real = canon(def.path)
    if (real) out.push({ id: def.id, path: def.path, real })
  }
  rootsCache = out
  return out
}

function blockedPrefixes() {
  if (blockedCache) return blockedCache
  blockedCache = [...new Set(BLOCKED_SHARED.map((p) => canon(p) ?? p))]
  return blockedCache
}

function inside(root, target) {
  return target === root || target.startsWith(root + path.sep)
}

function findRoot(real) {
  for (const r of roots()) {
    if (inside(r.real, real)) return r
  }
  return null
}

function isBlocked(real) {
  for (const p of blockedPrefixes()) {
    if (inside(p, real)) return true
  }
  return false
}

function hasBadChar(s) {
  return /[\u0000-\u001f\u007f]/.test(s)
}

export function resolveAlias(raw) {
  let p = raw
  const m = p.match(/^~\/storage\/(.*)$/)
  if (m) p = '/storage/emulated/0/' + m[1]
  if (p === '/sdcard' || p === '/mnt/sdcard' || p === '/storage/self/primary') {
    p = '/storage/emulated/0'
  }
  if (p.startsWith('/storage/self/primary/')) {
    p = '/storage/emulated/0/' + p.slice('/storage/self/primary/'.length)
  }
  return p
}

export function appliesTo(pathname) {
  return pathname === '/api/fs' || pathname.startsWith('/api/fs/') ||
    pathname === '/api/find' || pathname.startsWith('/api/find/')
}

export function evaluateFsPolicy(pathname, search) {
  if (!appliesTo(pathname)) return { blocked: false }

  const params = new URLSearchParams((search || '').replace(/^\?/, ''))
  const values = params.getAll('location[directory]')
  if (values.length === 0) {
    return { blocked: true, status: 400, reason: 'parameter location[directory] wajib ada' }
  }
  if (values.length > 1) {
    return { blocked: true, status: 400, reason: 'parameter location[directory] duplikat' }
  }

  const raw = values[0]
  if (hasBadChar(raw)) {
    return { blocked: true, status: 400, reason: 'location[directory] tidak valid' }
  }

  const aliased = resolveAlias(raw)
  const real = canon(aliased)
  if (!real) {
    return { blocked: true, status: 400, reason: 'location tidak ditemukan atau tidak dapat dikanonisasikan' }
  }

  const root = findRoot(real)
  if (!root) {
    return { blocked: true, status: 403, reason: 'location di luar root yang diizinkan' }
  }
  if (isBlocked(real)) {
    return { blocked: true, status: 403, reason: 'location pada direktori aplikasi pribadi Android' }
  }

  return { blocked: false, root: root.id, real }
}
