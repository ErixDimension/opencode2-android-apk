// Relay SSE khusus /api/event: piping verbatim, satu koneksi upstream per klien.
import http from 'node:http'
import { getCredentials, reloadCredentials } from './registry.mjs'
import { sendJson } from './respond.mjs'

export function relayEvent(req, res) {
  let creds
  try {
    creds = getCredentials()
  } catch {
    sendJson(res, 502, { error: 'UPSTREAM_UNAVAILABLE' })
    return
  }
  open(req, res, creds, false)
}

function open(req, res, creds, retried) {
  const u = new URL(creds.url + '/api/event')

  const up = http.request({
    hostname: u.hostname,
    port: u.port,
    path: u.pathname + u.search,
    method: 'GET',
    headers: {
      authorization: creds.auth,
      accept: 'text/event-stream',
      'cache-control': 'no-cache',
      'user-agent': 'flux-webui-adapter',
    },
  }, (upRes) => {
    // 401 hanya ditangani sebelum satu byte pun dikirim ke klien.
    if (upRes.statusCode === 401 && !retried) {
      upRes.resume()
      upRes.destroy()
      let fresh
      try {
        fresh = reloadCredentials()
      } catch {
        sendJson(res, 502, { error: 'UPSTREAM_AUTH' })
        return
      }
      open(req, res, fresh, true)
      return
    }

    if (upRes.statusCode === 401) {
      upRes.resume()
      upRes.destroy()
      sendJson(res, 502, { error: 'UPSTREAM_AUTH' })
      return
    }

    if (upRes.statusCode !== 200) {
      upRes.resume()
      upRes.destroy()
      sendJson(res, 502, { error: 'UPSTREAM_ERROR' })
      return
    }

    if (res.destroyed || res.writableEnded) {
      upRes.destroy()
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    if (typeof res.flushHeaders === 'function') res.flushHeaders()

    // Verbatim: tidak ada parsing, filtering, atau penambahan byte.
    upRes.pipe(res)

    upRes.on('error', () => {
      if (!res.writableEnded) res.destroy()
    })

    res.on('close', () => {
      if (!res.writableEnded) {
        upRes.destroy()
        up.destroy()
      }
    })

    req.on('aborted', () => {
      upRes.destroy()
      up.destroy()
    })
  })

  up.on('error', () => {
    if (!res.headersSent) sendJson(res, 502, { error: 'UPSTREAM_UNREACHABLE' })
    else res.destroy()
  })

  // Klien putus sebelum upstream merespons.
  res.on('close', () => {
    if (!res.headersSent) up.destroy()
  })

  up.end()
}
