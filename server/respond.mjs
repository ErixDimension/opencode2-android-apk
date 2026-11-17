// Respons helper + header keamanan untuk respons buatan adapter.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function securityHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CSP,
    ...extra,
  }
}

export function sendJson(res, status, obj, extra = {}) {
  if (res.writableEnded || res.destroyed) return
  const body = Buffer.from(JSON.stringify(obj))
  res.writeHead(status, securityHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    ...extra,
  }))
  res.end(body)
}

export function sendText(res, status, text, extra = {}) {
  if (res.writableEnded || res.destroyed) return
  const body = Buffer.from(text)
  res.writeHead(status, securityHeaders({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    ...extra,
  }))
  res.end(body)
}
