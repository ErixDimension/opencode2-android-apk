// sessionStore.ts — titik kebenaran sesi aktif. REST adalah kebenaran; event SSE
// hanya pemicu refetch ter-debounce (§0.2) dan penanda liveness. Event tidak dirender langsung.

import { eventStream } from './eventStream'
import { getMessages, listSessions, interruptSession, replyPermission, revertStage, revertClear, revertCommit, type Message } from './apiClient'
import { mapMessages, type FluxBlock, contextPercent } from './blockMapper'
import { DEBOUNCE_ACTIVE_MS, DEBOUNCE_IDLE_MS, PAGE_SIZE } from './apiClient'

export interface SessionView {
  id: string
  title?: string
  location?: { directory: string }
  model?: { id: string; providerID: string }
  tokens?: { input: number; output: number; reasoning: number; cache: { read: number; write: number } }
  updatedAt?: number
}

export interface StoreState {
  sessions: SessionView[]
  active: SessionView | null
  blocks: FluxBlock[]
  messages: Message[]
  cursor: { previous: string | null; next: string | null } | null
  loading: boolean
  sessionsError: string | null
  modelContextLimit: number | null
  contextPercent: number | null
  modelLabel: string
  activeRun: boolean
}

type Listener = (state: StoreState) => void

const initialState: StoreState = {
  sessions: [],
  active: null,
  blocks: [],
  messages: [],
  cursor: null,
  loading: false,
  sessionsError: null,
  modelContextLimit: null,
  contextPercent: null,
  modelLabel: '',
  activeRun: false,
}

export class SessionStore {
  #state = { ...initialState }
  #listeners = new Set<Listener>()
  #debounce: ReturnType<typeof setTimeout> | null = null
  #refetchQueued = false
  #abort: AbortController | null = null
  #pollTimer: ReturnType<typeof setTimeout> | null = null
  #pollDeadline: number | null = null

  constructor() {
    this.#wireEvents()
  }

  /*────────────────────────────────────────────────────────────────────
    Langganan
  ─────────────────────────────────────────────────────────────────────*/
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    listener(this.#state)
    return () => { this.#listeners.delete(listener) }
  }

  getState(): StoreState { return this.#state }

  /*────────────────────────────────────────────────────────────────────
    SSE wiring — event adalah sinyal, REST adalah kebenaran
  ─────────────────────────────────────────────────────────────────────*/
  #wireEvents(): void {
    eventStream.subscribe((frame) => {
      if (frame.kind !== 'event') return
      const envelope = frame.envelope
      const type = typeof envelope.type === 'string' ? envelope.type : ''
      const data = envelope.data as Record<string, unknown> | undefined
      const sessionID = data?.sessionID
        ? String(data.sessionID)
        : typeof envelope.sessionID === 'string'
          ? envelope.sessionID
          : ''

      const activeID = this.#state.active?.id
      if (!sessionID || sessionID !== activeID) return

      // §0.2 — tipe wajib: permission & penanda busy/idle sesi
      if (type.startsWith('permission')) {
        this.#requestRefetch('immediate')
        return
      }
      if (type === 'session.execution.started' || type === 'session.execution.succeeded' ||
          type === 'session.step.started' || type === 'session.step.ended' ||
          type === 'session.text.started' || type === 'session.text.ended') {
        this.#requestRefetch('busy-idle')
        return
      }
    })
  }

  #requestRefetch(mode: 'immediate' | 'busy-idle'): void {
    if (this.#debounce) clearTimeout(this.#debounce)
    const delay = mode === 'immediate' ? 0 :
      this.#state.activeRun ? DEBOUNCE_ACTIVE_MS : DEBOUNCE_IDLE_MS
    this.#refetchQueued = true
    this.#debounce = setTimeout(() => {
      this.#debounce = null
      if (this.#refetchQueued) void this.#refreshActive()
    }, delay)
  }

  /*────────────────────────────────────────────────────────────────────
    Sesi
  ─────────────────────────────────────────────────────────────────────*/
  async loadSessions(): Promise<void> {
    try {
      const sessions = await listSessions(50)
      this.#set({
        sessions: sessions.map((s) => ({
          id: s.id,
          title: s.title,
          location: s.location,
          model: s.model,
          tokens: s.tokens,
          updatedAt: s.time?.updated,
        })),
        sessionsError: null,
      })
    } catch (err) {
      // kegagalan harus terlihat, bukan diam sebagai "kosong"
      this.#set({
        sessionsError: err instanceof Error ? err.message : 'Gagal memuat daftar sesi.',
      })
    }
  }

  /*────────────────────────────────────────────────────────────────────
    Bootstrap berurutan: muat daftar, baru pilih sesi aktif pertama.
    Dipakai saat masuk Shell dan setelah login sukses di Gate.
    ────────────────────────────────────────────────────────────────────*/
  async bootstrap(): Promise<void> {
    await this.loadSessions()
    await this.loadFirstActive()
  }

  async setActive(sessionID: string): Promise<void> {
    const found = this.#state.sessions.find((s) => s.id === sessionID)
    if (!found) return
    this.#abort?.abort()
    this.#abort = new AbortController()
    this.#stopPolling()
    this.#set({ active: found, blocks: [], messages: [], cursor: null, loading: true, activeRun: false })
    await this.#loadMessages(0)
    this.#set({ loading: false })
    this.#refreshContext()
  }

  async loadFirstActive(): Promise<void> {
    if (this.#state.active) return
    if (this.#state.sessions.length > 0) await this.setActive(this.#state.sessions[0].id)
  }

  async createAndActivate(): Promise<void> {
    const { createSession } = await import('./apiClient')
    const s = await createSession()
    await this.loadSessions()
    await this.setActive(s.id)
  }

  /*────────────────────────────────────────────────────────────────────
    Pesan + blok (REST truth)
  ─────────────────────────────────────────────────────────────────────*/
  async #loadMessages(offset: number): Promise<void> {
    const active = this.#state.active
    if (!active) return
    const cursor = offset === 0 ? null : this.#state.cursor?.next
    const page = await getMessages(active.id, PAGE_SIZE, 'asc', cursor)
    const blocks = mapMessages(page.data)
    const existing = offset === 0 ? [] : this.#state.messages
    const allMessages = offset === 0 ? page.data : [...existing, ...page.data]
    this.#set({
      messages: allMessages,
      blocks: offset === 0 ? blocks : [...this.#state.blocks, ...blocks],
      cursor: page.cursor,
      activeRun: this.#inferRun(page.data),
    })
    this.#refreshContext()
  }

  async loadOlder(): Promise<void> {
    if (!this.#state.cursor?.next || this.#state.loading) return
    this.#set({ loading: true })
    await this.#loadMessages(this.#state.messages.length)
    this.#set({ loading: false })
  }

  #inferRun(messages: Message[]): boolean {
    const last = messages[messages.length - 1]
    if (!last || last.type !== 'assistant') return false
    return !(last as { time: { completed?: number } }).time.completed
  }

  async #refreshActive(): Promise<void> {
    if (!this.#state.active) return
    await this.#loadMessages(0)
  }

  #refreshContext(): void {
    const active = this.#state.active
    if (!active) return
    import('./apiClient').then(({ getModelDefault }) => {
      return getModelDefault().then((md) => {
        const limit = md.data.limit.context
        this.#set({ modelContextLimit: limit, modelLabel: md.data.name, contextPercent: contextPercent(active.tokens ?? null, limit) })
      }).catch(() => {
        // §0.15 — batas tidak tersedia: jangan countek persen
        this.#set({ modelContextLimit: null, contextPercent: null, modelLabel: active.model?.id ?? '' })
      })
    })
  }

  async sendPrompt(text: string): Promise<void> {
    const active = this.#state.active
    if (!active) return
    const { sendPrompt } = await import('./apiClient')
    await sendPrompt(active.id, text)
    // Jemput balasan: polling berkala sampai reply assistant tiba atau timeout 120 detik.
    // SSE = akselerator (refetch via event wiring); REST = kebenaran.
    this.#requestRefetch('busy-idle')
    this.#startPolling()
  }

  async interrupt(): Promise<void> {
    const active = this.#state.active
    if (!active) return
    await interruptSession(active.id)
    this.#stopPolling()
    this.#requestRefetch('immediate')
  }

  /*────────────────────────────────────────────────────────────────────
    Balasan terjemput — polling ±1,75s sampai reply assistant tiba
    atau timeout 120 detik (§0.3 N4.3).
    ─────────────────────────────────────────────────────────────────────*/
  #startPolling(): void {
    this.#stopPolling()
    this.#pollDeadline = Date.now() + 120000
    this.#tick()
  }

  #tick(): void {
    if (this.#pollDeadline == null || Date.now() > this.#pollDeadline) {
      this.#stopPolling()
      return
    }
    const before = this.#state.messages.length
    void this.#loadMessages(0).then(() => {
      const last = this.#state.messages[this.#state.messages.length - 1]
      const assistantArrived =
        this.#state.messages.length > before &&
        last &&
        last.type === 'assistant'
      const runSelesai = !this.#state.activeRun
      if (assistantArrived || runSelesai) {
        this.#stopPolling()
        return
      }
      this.#pollTimer = setTimeout(() => this.#tick(), 1750)
    }).catch(() => {
      this.#pollTimer = setTimeout(() => this.#tick(), 1750)
    })
  }

  #stopPolling(): void {
    if (this.#pollTimer) {
      clearTimeout(this.#pollTimer)
      this.#pollTimer = null
    }
    this.#pollDeadline = null
  }

  async replyPermission(requestID: string, reply: 'accept' | 'reject' | 'always' | 'once', message = ''): Promise<void> {
    const active = this.#state.active
    if (!active) return
    await replyPermission(active.id, requestID, reply, message)
    this.#requestRefetch('immediate')
  }

  /*────────────────────────────────────────────────────────────────────
    Revert (§0.14)
  ─────────────────────────────────────────────────────────────────────*/
  async revertStage(messageID: string): Promise<void> {
    await revertStage(messageID)
    this.#requestRefetch('immediate')
  }
  async revertClear(): Promise<void> {
    await revertClear()
    this.#requestRefetch('immediate')
  }
  async revertCommit(): Promise<void> {
    await revertCommit()
    this.#requestRefetch('immediate')
  }

  /*────────────────────────────────────────────────────────────────────
    Intern
  ─────────────────────────────────────────────────────────────────────*/
  #set(patch: Partial<StoreState>): void {
    this.#state = { ...this.#state, ...patch }
    const snap = this.#state
    for (const listener of this.#listeners) listener(snap)
  }
}

export const sessionStore = new SessionStore()
