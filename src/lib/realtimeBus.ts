// Pub/sub minimal di atas satu stream SSE.
import type { FluxEnvelope } from './sseParser'

type Handler = (envelope: FluxEnvelope) => void

const exact = new Map<string, Set<Handler>>()
const prefixes: Array<{ prefix: string; handlers: Set<Handler> }> = []
const wildcards = new Set<Handler>()

function safeCall(handler: Handler, envelope: FluxEnvelope): void {
  try {
    handler(envelope)
  } catch {
    // subscriber error tidak boleh mematikan stream
  }
}

export function publish(envelope: FluxEnvelope): void {
  const type = typeof envelope.type === 'string' ? envelope.type : ''

  for (const handler of wildcards) safeCall(handler, envelope)

  if (!type) return
  for (const handler of exact.get(type) ?? []) safeCall(handler, envelope)
  for (const entry of prefixes) {
    if (type.startsWith(entry.prefix)) {
      for (const handler of entry.handlers) safeCall(handler, envelope)
    }
  }
}

export function subscribe(pattern: string, handler: Handler): () => void {
  if (pattern === '*') {
    wildcards.add(handler)
    return () => wildcards.delete(handler)
  }

  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    let entry = prefixes.find((p) => p.prefix === prefix)
    if (!entry) {
      entry = { prefix, handlers: new Set() }
      prefixes.push(entry)
    }
    entry.handlers.add(handler)
    return () => entry?.handlers.delete(handler)
  }

  let set = exact.get(pattern)
  if (!set) {
    set = new Set()
    exact.set(pattern, set)
  }
  set.add(handler)
  return () => set?.delete(handler)
}
