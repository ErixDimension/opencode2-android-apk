// Manajer koneksi SSE via fetch + ReadableStream (bukan EventSource).
import { createSseParser, type ParsedFrame } from './sseParser'
import { publish } from './realtimeBus'

export type StreamState =
  | 'idle'
  | 'connecting'
  | 'online'
  | 'reconnecting'
  | 'offline'
  | 'unauthorized'
  | 'error'

export type StreamStatus = {
  state: StreamState
  reconnects: number
  dataFrames: number
  heartbeats: number
  badFrames: number
}

type FrameHandler = (frame: ParsedFrame) => void
type StatusHandler = (status: StreamStatus) => void

const EVENT_URL = '/api/event'
const BACKOFF_BASE_MS = 1000
const BACKOFF_CAP_MS = 30000
const WATCHDOG_MS = 45000

export class EventStream {
  #status: StreamStatus = {
    state: 'idle',
    reconnects: 0,
    dataFrames: 0,
    heartbeats: 0,
    badFrames: 0,
  }
  #frameHandlers = new Set<FrameHandler>()
  #statusHandlers = new Set<StatusHandler>()
  #parser = createSseParser()
  #running = false
  #stopped = false
  #attempt = 0
  #abort: AbortController | null = null
  #retryTimer: ReturnType<typeof setTimeout> | null = null
  #watchdogTimer: ReturnType<typeof setTimeout> | null = null

  start(): void {
    if (this.#running) return
    this.#running = true
    this.#stopped = false
    this.#attempt = 0
    void this.#connect('connecting')
  }

  stop(): void {
    this.#stopped = true
    this.#running = false
    this.#clearTimers()
    this.#abort?.abort()
    this.#abort = null
    this.#parser.reset()
    this.#setState('idle')
  }

  subscribe(handler: FrameHandler): () => void {
    this.#frameHandlers.add(handler)
    return () => this.#frameHandlers.delete(handler)
  }

  subscribeStatus(handler: StatusHandler): () => void {
    this.#statusHandlers.add(handler)
    return () => this.#statusHandlers.delete(handler)
  }

  getState(): StreamState {
    return this.#status.state
  }

  getStatus(): StreamStatus {
    return { ...this.#status }
  }

  async #connect(initialState: StreamState): Promise<void> {
    if (this.#stopped) return
    this.#setState(initialState)

    const ac = new AbortController()
    this.#abort = ac
    this.#armWatchdog(ac)

    try {
      const response = await fetch(EVENT_URL, {
        method: 'GET',
        headers: { accept: 'text/event-stream', 'cache-control': 'no-cache' },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: ac.signal,
      })

      if (this.#stopped) return

      if (response.status === 401) {
        // 401 = sesi tidak valid: jangan mati permanen (latch). Backoff + reconnect
        // agar stream pulih sendiri bila kredensial di-refresh (mis. rotasi password).
        this.#clearWatchdog()
        this.#scheduleReconnect()
        return
      }

      if (!response.ok || !response.body) {
        this.#clearWatchdog()
        this.#setState('error')
        this.#scheduleReconnect()
        return
      }

      this.#attempt = 0
      this.#setState('online')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        this.#armWatchdog(ac)
        const text = decoder.decode(value, { stream: true })
        if (text) this.#ingest(text)
      }

      const tail = decoder.decode()
      if (tail) this.#ingest(tail)

      this.#clearWatchdog()
      if (!this.#stopped) this.#scheduleReconnect()
    } catch {
      this.#clearWatchdog()
      if (this.#stopped) return
      this.#setState('offline')
      this.#scheduleReconnect()
    } finally {
      if (this.#abort === ac) this.#abort = null
    }
  }

  #ingest(text: string): void {
    for (const frame of this.#parser.feed(text)) this.#handleFrame(frame)
  }

  #handleFrame(frame: ParsedFrame): void {
    if (frame.kind === 'event') {
      this.#status = { ...this.#status, dataFrames: this.#status.dataFrames + 1 }
      publish(frame.envelope)
    } else if (frame.kind === 'heartbeat') {
      this.#status = { ...this.#status, heartbeats: this.#status.heartbeats + 1 }
    } else {
      this.#status = { ...this.#status, badFrames: this.#status.badFrames + 1 }
    }

    this.#notifyStatus()
    for (const handler of this.#frameHandlers) {
      try {
        handler(frame)
      } catch {
        // abaikan error subscriber
      }
    }
  }

  #scheduleReconnect(): void {
    if (this.#stopped) return
    this.#setState('reconnecting')
    this.#status = { ...this.#status, reconnects: this.#status.reconnects + 1 }
    this.#notifyStatus()

    const exponential = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** this.#attempt)
    this.#attempt += 1
    const jittered = Math.round(exponential * (0.75 + Math.random() * 0.5))
    const delay = Math.min(BACKOFF_CAP_MS, jittered)

    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null
      void this.#connect('connecting')
    }, delay)
  }

  #armWatchdog(ac: AbortController): void {
    this.#clearWatchdog()
    this.#watchdogTimer = setTimeout(() => {
      // Tidak ada byte selama 45 dtk (heartbeat ~15 dtk): paksa reconnect.
      ac.abort()
    }, WATCHDOG_MS)
  }

  #clearWatchdog(): void {
    if (this.#watchdogTimer) {
      clearTimeout(this.#watchdogTimer)
      this.#watchdogTimer = null
    }
  }

  #clearTimers(): void {
    this.#clearWatchdog()
    if (this.#retryTimer) {
      clearTimeout(this.#retryTimer)
      this.#retryTimer = null
    }
  }

  #setState(state: StreamState): void {
    if (this.#status.state === state) return
    this.#status = { ...this.#status, state }
    this.#notifyStatus()
  }

  #notifyStatus(): void {
    const snapshot = this.getStatus()
    for (const handler of this.#statusHandlers) {
      try {
        handler(snapshot)
      } catch {
        // abaikan error subscriber
      }
    }
  }
}

export const eventStream = new EventStream()
