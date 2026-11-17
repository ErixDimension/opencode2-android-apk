#!/usr/bin/env node
// flux-webui adapter — N2: registry, auth, proxy, FS policy.
// Node builtins only (zero npm dependencies).
import http from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as auth from './server/auth.mjs'
import * as credentials from './server/credentials.mjs'
import { checkUpstream } from './server/registry.mjs'
import { proxyRequest } from './server/proxy.mjs'
import { evaluateFsPolicy } from './server/fs-policy.mjs'
import { relayEvent } from './server/sse.mjs'
import { securityHeaders, sendJson, sendText } from './server/respond.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(ROOT, 'dist')
const HOST = '127.0.0.1'
const PORT = Number(process.env.FLUX_PORT) || 28572
const BUILD = 'n2.5'
const LOGIN_BODY_LIMIT = 4096

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

function contentType(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        tooLarge = true
        chunks.length = 0
        return
      }
      if (!tooLarge) chunks.push(chunk)
    })
    req.on('end', () => resolve({ tooLarge, body: tooLarge ? null : Buffer.concat(chunks) }))
    req.on('error', reject)
  })
}

async function readJson(req, res) {
  const declared = Number(req.headers['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > LOGIN_BODY_LIMIT) {
    sendJson(res, 413, { error: 'PAYLOAD_TOO_LARGE' })
    return null
  }

  let payload
  try {
    payload = await readBody(req, LOGIN_BODY_LIMIT)
  } catch {
    sendJson(res, 400, { error: 'BAD_REQUEST' })
    return null
  }
  if (payload.tooLarge) {
    sendJson(res, 413, { error: 'PAYLOAD_TOO_LARGE' })
    return null
  }

  try {
    return JSON.parse(payload.body.toString('utf8') || '{}')
  } catch {
    sendJson(res, 400, { error: 'BAD_REQUEST' })
    return null
  }
}

async function handleSetup(req, res) {
  if (credentials.getAuthState() === 'ready') {
    sendJson(res, 409, { error: 'ALREADY_SETUP' })
    return
  }

  const body = await readJson(req, res)
  if (!body) return

  const problem = credentials.validatePasswordShape(body.password)
  if (problem) {
    sendJson(res, 400, { error: problem })
    return
  }

  credentials.createStore(body.password)
  const token = auth.createSession()
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieFor(token) })
}

async function handleLogin(req, res) {
  if (credentials.getAuthState() !== 'ready') {
    sendJson(res, 409, { error: 'SETUP_REQUIRED' })
    return
  }

  const body = await readJson(req, res)
  if (!body) return

  const ip = req.socket.remoteAddress ?? 'unknown'
  if (auth.isLocked(ip)) {
    sendJson(res, 429, { error: 'RATE_LIMITED' }, { 'Retry-After': String(auth.retryAfterSeconds()) })
    return
  }

  if (!credentials.verifyPassword(body.password)) {
    auth.recordFailure(ip)
    sendJson(res, 401, { error: 'INVALID_PASSWORD' })
    return
  }

  auth.clearFailures(ip)
  const token = auth.createSession()
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieFor(token) })
}

async function handleChangePassword(req, res) {
  const cookies = auth.parseCookies(req.headers.cookie)
  const token = cookies[auth.COOKIE_NAME]
  if (!auth.validateSession(token)) {
    sendJson(res, 401, { error: 'UNAUTHORIZED' })
    return
  }

  const body = await readJson(req, res)
  if (!body) return

  if (!credentials.verifyPassword(body.currentPassword)) {
    sendJson(res, 401, { error: 'INVALID_PASSWORD' })
    return
  }

  const problem = credentials.validatePasswordShape(body.newPassword)
  if (problem) {
    sendJson(res, 400, { error: problem })
    return
  }

  const updated = credentials.changePassword(body.currentPassword, body.newPassword)
  if (!updated) {
    sendJson(res, 401, { error: 'INVALID_PASSWORD' })
    return
  }

  auth.invalidateAllSessions()
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.clearedCookie() })
}

function handleLogout(req, res) {
  const cookies = auth.parseCookies(req.headers.cookie)
  auth.destroySession(cookies[auth.COOKIE_NAME])
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.clearedCookie() })
}

async function serveFile(req, res, file) {
  let info
  try {
    info = await stat(file)
  } catch {
    sendText(res, 404, 'Not Found')
    return
  }
  if (!info.isFile()) {
    sendText(res, 404, 'Not Found')
    return
  }
  res.writeHead(200, securityHeaders({
    'Content-Type': contentType(file),
    'Content-Length': info.size,
  }))
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(file)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}

async function serveStatic(req, res, pathname) {
  let relative = pathname.replace(/^\/+/, '')
  let file = path.resolve(DIST, relative)

  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    sendText(res, 403, 'Forbidden')
    return
  }

  if (relative === '' || file === DIST) {
    file = path.join(DIST, 'index.html')
  }

  let info = null
  try {
    info = await stat(file)
  } catch {
    info = null
  }

  if (info === null || !info.isFile()) {
    await serveFile(req, res, path.join(DIST, 'index.html'))
    return
  }

  await serveFile(req, res, file)
}

const server = http.createServer(async (req, res) => {
  const method = req.method ?? 'GET'
  const rawUrl = req.url ?? '/'
  const queryAt = rawUrl.indexOf('?')
  const rawPath = queryAt === -1 ? rawUrl : rawUrl.slice(0, queryAt)
  const search = queryAt === -1 ? '' : rawUrl.slice(queryAt + 1)

  let pathname
  try {
    pathname = decodeURIComponent(rawPath)
  } catch {
    sendText(res, 400, 'Bad Request')
    return
  }
  if (pathname.includes('\0')) {
    sendText(res, 400, 'Bad Request')
    return
  }

  // Route public: login/logout dicek sebelum gate /api.
  if (pathname === '/login') {
    if (method !== 'POST') {
      sendText(res, 405, 'Method Not Allowed', { Allow: 'POST' })
      return
    }
    await handleLogin(req, res)
    return
  }

  if (pathname === '/logout') {
    if (method !== 'POST') {
      sendText(res, 405, 'Method Not Allowed', { Allow: 'POST' })
      return
    }
    handleLogout(req, res)
    return
  }

  if (pathname === '/setup') {
    if (method !== 'POST') {
      sendText(res, 405, 'Method Not Allowed', { Allow: 'POST' })
      return
    }
    await handleSetup(req, res)
    return
  }

  if (pathname === '/healthz') {
    if (method !== 'GET' && method !== 'HEAD') {
      sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
      return
    }
    const reachable = await checkUpstream(2000)
    sendJson(res, 200, {
      ok: true,
      service: 'flux-webui',
      build: BUILD,
      upstream: { reachable },
    })
    return
  }

  // Endpoint auth milik adapter: dicek sebelum gate /api dan sebelum proxy.
  if (pathname === '/api/auth/state') {
    if (method !== 'GET') {
      sendText(res, 405, 'Method Not Allowed', { Allow: 'GET' })
      return
    }
    sendJson(res, 200, { state: credentials.getAuthState() })
    return
  }

  if (pathname === '/api/auth/change-password') {
    if (method !== 'POST') {
      sendText(res, 405, 'Method Not Allowed', { Allow: 'POST' })
      return
    }
    await handleChangePassword(req, res)
    return
  }

  if (pathname.startsWith('/api/auth/')) {
    sendJson(res, 404, { error: 'NOT_FOUND' })
    return
  }

  if (pathname.startsWith('/api/')) {
    const cookies = auth.parseCookies(req.headers.cookie)
    const token = cookies[auth.COOKIE_NAME]
    const session = auth.validateSession(token)
    if (!session) {
      sendJson(res, 401, { error: 'UNAUTHORIZED' })
      return
    }
    if (session.renew) {
      res.setHeader('Set-Cookie', auth.cookieFor(token))
    }

    if (pathname === '/api/event') {
      if (method !== 'GET') {
        sendText(res, 405, 'Method Not Allowed', { Allow: 'GET' })
        return
      }
      relayEvent(req, res)
      return
    }

    const policy = evaluateFsPolicy(pathname, search)
    if (policy.blocked) {
      sendJson(res, policy.status, {
        error: policy.status === 400 ? 'FS_BAD_REQUEST' : 'FS_FORBIDDEN',
        message: policy.reason,
      })
      return
    }

    await proxyRequest(req, res)
    return
  }

  if (method !== 'GET' && method !== 'HEAD') {
    sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
    return
  }

  await serveStatic(req, res, pathname)
})

server.on('error', (err) => {
  console.error(`flux-webui: server error: ${err.message}`)
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  console.log(`flux-webui: listening on http://${HOST}:${PORT} (build ${BUILD})`)
  console.log(`flux-webui: static root ${DIST}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`flux-webui: received ${signal}, shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 3000).unref()
  })
}
