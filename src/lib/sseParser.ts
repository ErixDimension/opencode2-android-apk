// Parser SSE murni (tanpa DOM/React) agar bisa diuji di Node.
export type FluxEnvelope = {
  type?: string
  id?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}

export type ParsedFrame =
  | { kind: 'event'; envelope: FluxEnvelope }
  | { kind: 'heartbeat' }
  | { kind: 'bad-frame'; raw: string }

const FRAME_SEPARATOR = /\r\n\r\n|\n\n|\r\r/

function parseFrame(raw: string): ParsedFrame | null {
  const lines = raw.split(/\r\n|\n|\r/)
  const dataLines: string[] = []
  let sawComment = false

  for (const line of lines) {
    if (line === '') continue
    if (line.startsWith(':')) {
      sawComment = true
      continue
    }
    const at = line.indexOf(':')
    const field = at === -1 ? line : line.slice(0, at)
    let value = at === -1 ? '' : line.slice(at + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') dataLines.push(value)
  }

  if (dataLines.length > 0) {
    const payload = dataLines.join('\n')
    try {
      return { kind: 'event', envelope: JSON.parse(payload) as FluxEnvelope }
    } catch {
      return { kind: 'bad-frame', raw: payload }
    }
  }
  if (sawComment) return { kind: 'heartbeat' }
  return null
}

export function createSseParser() {
  let buffer = ''

  return {
    feed(chunk: string): ParsedFrame[] {
      buffer += chunk
      const out: ParsedFrame[] = []
      for (;;) {
        const match = FRAME_SEPARATOR.exec(buffer)
        if (!match) break
        const raw = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        const frame = parseFrame(raw)
        if (frame) out.push(frame)
      }
      return out
    },

    flush(): ParsedFrame[] {
      const raw = buffer
      buffer = ''
      if (raw === '') return []
      const frame = parseFrame(raw)
      return frame ? [frame] : []
    },

    reset(): void {
      buffer = ''
    },
  }
}
