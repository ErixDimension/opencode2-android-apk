// Registry OpenCode: kredensial upstream dibaca dari file registry.
// Password hanya hidup di memori proses; tidak pernah dicetak/ditulis.
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_PATH = path.join(os.homedir(), '.local/state/opencode/service-android-termux.json')
export const REGISTRY_PATH = process.env.FLUX_REGISTRY_PATH || DEFAULT_PATH

let cached = null

function parseRegistry() {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8')
  const data = JSON.parse(raw)
  if (!data || typeof data.url !== 'string' || typeof data.password !== 'string' || !data.password) {
    throw new Error('registry tidak lengkap (url/password)')
  }
  const u = new URL(data.url)
  if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1') {
    throw new Error('url registry harus http://127.0.0.1')
  }
  return {
    url: data.url.replace(/\/+$/, ''),
    auth: 'Basic ' + Buffer.from(`opencode:${data.password}`).toString('base64'),
  }
}

export function reloadCredentials() {
  cached = parseRegistry()
  return cached
}

export function getCredentials() {
  return cached ?? reloadCredentials()
}

export function upstreamUrl(pathAndQuery) {
  return getCredentials().url + pathAndQuery
}

export function checkUpstream(timeoutMs = 2000) {
  return new Promise((resolve) => {
    let creds
    try {
      creds = getCredentials()
    } catch {
      resolve(false)
      return
    }
    const u = new URL(creds.url + '/api/health')
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { authorization: creds.auth, accept: 'application/json' },
      timeout: timeoutMs,
    }, (res) => {
      res.resume()
      res.on('end', () => done(res.statusCode === 200))
      res.on('close', () => done(res.statusCode === 200))
    })
    req.on('timeout', () => {
      req.destroy()
      done(false)
    })
    req.on('error', () => done(false))
    req.end()
  })
}
