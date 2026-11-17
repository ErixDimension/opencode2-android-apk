// Proxy generik /api/*: streaming, batas body 2 MiB, retry sekali saat 401.
import http from 'node:http'
import { getCredentials, reloadCredentials } from './registry.mjs'
import { sendJson } from './respond.mjs'

const MAX_BODY = 2 * 1024 * 1024
const PASS_HEADERS = [
  'content-type',
  'content-disposition',
  'etag',
  'last-modified',
  'content-length',
  'accept-ranges',
  'content-range',
  'cache-control',
]

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
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

function attempt(target, method, headers, body, register) {
  return new Promise((resolve, reject) => {
    const u = new URL(target)
    const up = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: { ...headers, host: u.host },
    }, (res) => resolve({ res, up }))
    register(up)
    up.on('error', reject)
    if (body && body.length > 0) up.end(body)
    else up.end()
  })
}

export async function proxyRequest(req, res) {
  const method = req.method ?? 'GET'
  let body = null

  if (method !== 'GET' && method !== 'HEAD') {
    let parsed
    try {
      parsed = await readBody(req)
    } catch {
      sendJson(res, 400, { error: 'BAD_REQUEST' })
      return
    }
    if (parsed.tooLarge) {
      sendJson(res, 413, { error: 'PAYLOAD_TOO_LARGE' })
      return
    }
    body = parsed.body
  }

  let creds
  try {
    creds = getCredentials()
  } catch {
    sendJson(res, 502, { error: 'UPSTREAM_UNAVAILABLE' })
    return
  }

  const target = creds.url + (req.url ?? '/')
  const headers = { authorization: creds.auth, 'user-agent': 'flux-webui-adapter' }
  if (req.headers.accept) headers.accept = req.headers.accept
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (body) headers['content-length'] = body.length

  let activeUp = null
  const register = (up) => {
    activeUp = up
  }

  let upstream
  try {
    upstream = await attempt(target, method, headers, body, register)
  } catch {
    sendJson(res, 502, { error: 'UPSTREAM_UNREACHABLE' })
    return
  }

  // 401 upstream tidak pernah diteruskan mentah ke browser.
  if (upstream.res.statusCode === 401) {
    upstream.res.resume()
    upstream.res.destroy()
    let fresh
    try {
      fresh = reloadCredentials()
    } catch {
      sendJson(res, 502, { error: 'UPSTREAM_AUTH' })
      return
    }
    const retryHeaders = { ...headers, authorization: fresh.auth }
    try {
      upstream = await attempt(fresh.url + (req.url ?? '/'), method, retryHeaders, body, register)
    } catch {
      sendJson(res, 502, { error: 'UPSTREAM_UNREACHABLE' })
      return
    }
    if (upstream.res.statusCode === 401) {
      upstream.res.resume()
      upstream.res.destroy()
      sendJson(res, 502, { error: 'UPSTREAM_AUTH' })
      return
    }
  }

  const upRes = upstream.res
  const outHeaders = { 'X-Content-Type-Options': 'nosniff' }
  for (const name of PASS_HEADERS) {
    if (upRes.headers[name] !== undefined) outHeaders[name] = upRes.headers[name]
  }

  res.writeHead(upRes.statusCode ?? 502, outHeaders)

  const abortUpstream = () => {
    if (!res.writableEnded) {
      upRes.destroy()
      activeUp?.destroy()
    }
  }
  res.on('close', abortUpstream)
  req.on('aborted', abortUpstream)

  upRes.on('error', () => {
    if (!res.writableEnded) res.destroy()
  })
  upRes.pipe(res)
}
