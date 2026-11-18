// sessionStore.ts — titik kebenaran sesi aktif. REST adalah kebenaran; event SSE
// hanya pemicu refetch ter-debounce (§0.2) dan penanda liveness. Event tidak dirender langsung.

import { eventStream } from './eventStream'
import {
  getMessages,
  listSessions,
  interruptSession,
  deleteSession,
  replyPermission,
  revertStage,
  revertClear,
  revertCommit,
  getSessionAliases,
  setSessionAlias,
  deleteSessionAlias,
  type Message,
} from './apiClient'
import { mapMessages, type FluxBlock, contextPercent } from './blockMapper'
import { DEBOUNCE_ACTIVE_MS, DEBOUNCE_IDLE_MS, PAGE_SIZE } from './apiClient'

export interface SessionView {
  id: string
  // §3 N4.4.4 — `title` = judul EFEKTIF (alias ?? judul upstream). `titleUpstream`
  // menyimpan judul asli untuk baris "judul asli: … · Kembalikan" di konsol rename.
  title?: string
  titleUpstream?: string
  alias?: string | null
  location?: { directory: string }
  model?: { id: string; providerID: string }
  tokens?: { input: number; output: number; reasoning: number; cache: { read: number; write: number } }
  updatedAt?: number
}

export interface StoreState {
  sessions: SessionView[]
  aliases: Record<string, string>
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
  sessionBusy: Record<string, boolean>
  usageOpen: boolean
  permissionOpen: boolean
  pendingPermission: { requestID: string; sessionID: string; tool: string; input: string }[]
  permissionResult: { kind: 'once' | 'always' | 'reject' | 'expired'; tool: string } | null
}

type Listener = (state: StoreState) => void

const initialState: StoreState = {
  sessions: [],
  aliases: {},
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
  sessionBusy: {},
  usageOpen: false,
  permissionOpen: false,
  pendingPermission: [],
  permissionResult: null,
}

export class SessionStore {
  #state = { ...initialState }
  #listeners = new Set<Listener>()
  #debounce: ReturnType<typeof setTimeout> | null = null
  #refetchQueued = false
  #abort: AbortController | null = null
  #pollTimer: ReturnType<typeof setTimeout> | null = null
  #pollDeadline: number | null = null
  #awaitingReply: boolean = false

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

      // §7.3/7.4 — penanda busy per SESI (bukan hanya aktif) dari event session.*,
      // supaya sesi latar yang bekerja juga tampil "Sedang bekerja" di daftar.
      // Upstream tidak menyediakan field status pada record sesi (proses discovery),
      // jadi event SSE adalah satu-satunya sinyal; tanpa event → idle (jujur).
      // §7.3/7.4 — penanda busy per sesi dari event session.*.
      // started → busy; succeeded/failed → idle.
      // step.ended / text.ended hanya memicu refetch (menyala di tengah run),
      // JANGAN mematikan busy (penanda akhir run tetap succeeded/failed).
      const isBusyStart =
        type === 'session.execution.started' || type === 'session.step.started' || type === 'session.text.started'
      const isBusyEnd = type === 'session.execution.succeeded' || type === 'session.execution.failed'
      if (sessionID && (isBusyStart || isBusyEnd)) {
        this.#set({
          sessionBusy: { ...this.#state.sessionBusy, [sessionID]: isBusyStart },
        })
        const activeID = this.#state.active?.id
        if (sessionID === activeID) this.#requestRefetch('busy-idle')
        return
      }
      if (sessionID && (type === 'session.step.ended' || type === 'session.text.ended')) {
        const activeID = this.#state.active?.id
        if (sessionID === activeID) this.#requestRefetch('busy-idle')
        return
      }

      const activeID = this.#state.active?.id
      if (!sessionID || sessionID !== activeID) return

      // §0.2 — tipe wajib: permission & penanda busy/idle sesi.
      // Event permission untuk sesi aktif → buka lembar izin (jika data
      // permintaan tersedia di envelope). permission.asked tidak pernah nyala
      // live karena aturan wildcard :*:* auto-approve (Latarangan 8.5) — jalur
      // ini siap infrastruktur, diam bila tidak ada event nyata.
      if (type.startsWith('permission')) {
        this.#requestRefetch('immediate')
        const requestID = String(data?.requestID ?? data?.permissionID ?? data?.id ?? '')
        const tool = String(data?.tool ?? data?.name ?? '')
        const raw = data?.input ?? data?.params ?? ''
        const input = typeof raw === 'string' ? raw : JSON.stringify(raw)
        if (requestID || tool) {
          this.#set({
            permissionOpen: true,
            pendingPermission: [{ requestID, sessionID, tool, input }],
            permissionResult: null,
          })
        }
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
      // §3 N4.4.4 — alias untuk sesi yang sudah tidak ada di daftar upstream
      // diabaikan (dibersihkan di klien; tidak perlu endpoint khusus).
      const knownIDs = new Set(sessions.map((s) => s.id))
      const aliases = Object.fromEntries(
        Object.entries(this.#state.aliases).filter(([id]) => knownIDs.has(id))
      )
      this.#set({
        sessions: sessions.map((s) => ({
          id: s.id,
          title: aliases[s.id] ?? s.title,
          titleUpstream: s.title,
          alias: aliases[s.id] ?? null,
          location: s.location,
          model: s.model,
          tokens: s.tokens,
          updatedAt: s.time?.updated,
        })),
        aliases,
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
    Alias judul lokal (N4.4.4) — dimuat sekali saat bootstrap; judul
    efektif = alias ?? judul upstream, dipakai di semua tempat tampilan.
    ────────────────────────────────────────────────────────────────────*/
  async #loadAliases(): Promise<void> {
    try {
      this.#set({ aliases: await getSessionAliases() })
    } catch {
      // Alias gagal dimuat bukan alasan menggagalkan bootstrap: tampil
      // judul upstream (jujur), bukan judul karangan.
      this.#set({ aliases: {} })
    }
  }

  /*────────────────────────────────────────────────────────────────────
    Bootstrap berurutan: muat alias + daftar, baru pilih sesi aktif pertama.
    Dipakai saat masuk Shell dan setelah login sukses di Gate.
    ────────────────────────────────────────────────────────────────────*/
  async bootstrap(): Promise<void> {
    await this.#loadAliases()
    await this.loadSessions()
    await this.loadFirstActive()
  }

  async setActive(sessionID: string): Promise<void> {
    const found = this.#state.sessions.find((s) => s.id === sessionID)
    if (!found) return
    this.#abort?.abort()
    this.#abort = new AbortController()
    this.#stopPolling()
    this.#awaitingReply = false
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
    // §0.17 — muat awal = 50 pesan TERAKHIR (order desc), balik agar tampilan
    // menaik; cursor.next = halaman lebih lama (prepend saat "Muat lebih lama").
    const page = await getMessages(active.id, PAGE_SIZE, 'desc', cursor)
    const oldestFirst = [...page.data].reverse()
    const blocks = mapMessages(oldestFirst)
    const existing = offset === 0 ? [] : this.#state.messages
    const allMessages = offset === 0 ? oldestFirst : [...oldestFirst, ...existing]
    this.#set({
      messages: allMessages,
      blocks: offset === 0 ? blocks : [...blocks, ...this.#state.blocks],
      cursor: page.cursor,
      activeRun: this.#inferRun(allMessages),
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
    if (messages.length === 0) return false
    let lastAssistant = -1
    let lastUser = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'assistant' && lastAssistant === -1) lastAssistant = i
      if (messages[i].type === 'user' && lastUser === -1) lastUser = i
      if (lastAssistant !== -1 && lastUser !== -1) break
    }
    // Pesan user lebih baru dari assistant terakhir = menunggu balasan → masih berjalan.
    if (lastUser > lastAssistant) return true
    // Tidak ada assistant sama sekali → tidak ada run yang terlacak.
    if (lastAssistant === -1) return false
    // Assistant terakhir: masih berjalan jika belum selesai (completed/finish kosong).
    const t = messages[lastAssistant] as { time: { completed?: number }; finish?: string; rawFinish?: string }
    return !t.time?.completed
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
    // Setelah kirim, keadaan "belum ada balasan" = SEDANG MENUNGGU, bukan
    // selesai. Tandai supaya polling tidak mati pada tick pertama (pesan
    // user baru mungkin belum muncul di server saat pertama kali dimuat).
    this.#awaitingReply = true
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
    this.#awaitingReply = false
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
      this.#awaitingReply = false
      return
    }
    void this.#loadMessages(0).then(() => {
      const stillRunning = this.#state.active ? this.#inferRun(this.#state.messages) : false
      // Berhenti hanya jika run benar-benar selesai dan tidak ada balasan
      // yang masih kita tunggu (menghindari mati terlalu awal saat pesan user
      // baru belum muncul di server pada tick pertama sesudah kirim).
      if (!stillRunning && !this.#awaitingReply) {
        this.#stopPolling()
        this.#awaitingReply = false
        return
      }
      this.#awaitingReply = false
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
    Lembar izin (§8.1): pendingPermission sekarang antre (array).
  ─────────────────────────────────────────────────────────────────────*/
  openPermissionSheet(pending: { requestID: string; sessionID: string; tool: string; input: string }[]): void {
    this.#set({ permissionOpen: true, pendingPermission: pending, permissionResult: null })
  }

  closePermissionSheet(): void {
    this.#set({ permissionOpen: false, pendingPermission: [], permissionResult: null })
  }

  setPermissionResult(kind: 'once' | 'always' | 'reject' | 'expired', tool: string): void {
    this.#set({ permissionResult: { kind, tool } })
  }

  /*────────────────────────────────────────────────────────────────────
    Lempar statistik sesi (§7.10 — dibuka dari Underbar atau kartu aktif).
  ─────────────────────────────────────────────────────────────────────*/
  openUsageSheet(): void {
    this.#set({ usageOpen: true })
  }

  closeUsageSheet(): void {
    this.#set({ usageOpen: false })
  }

  /*────────────────────────────────────────────────────────────────────
    Hapus sesi (§7.6): interrupt dulu bila sesi aktif sedang berjalan,
    baru DELETE; tidak pernah diam-diam gagal. Status non-204 dicatat
    ke sessionsError (tidak disamarkan sebagai sukses).
  ─────────────────────────────────────────────────────────────────────*/
  async removeSession(id: string): Promise<void> {
    const isActive = this.#state.active?.id === id
    if (isActive && this.#state.activeRun) {
      await this.interrupt()
    }
    const res = await deleteSession(id)
    if (!res.ok || res.status !== 204) {
      const msg = `Gagal menghapus sesi (server ${res.status}).`
      this.#set({ sessionsError: msg })
      throw new Error(msg)
    }
    await this.loadSessions()
    if (isActive) {
      this.#set({ active: null, blocks: [], messages: [], cursor: null, activeRun: false })
      if (this.#state.sessions.length > 0) await this.setActive(this.#state.sessions[0].id)
    }
  }

  /*────────────────────────────────────────────────────────────────────
    Ganti judul (§3 N4.4.4): alias lokal via PUT /api/session-alias/:id.
    PATCH upstream TIDAK dicoba lagi (terbukti 404). Sukses → judul efektif
    langsung berubah tanpa refetch; gagal → chip error jujur.
  ─────────────────────────────────────────────────────────────────────*/
  async renameSession(id: string, title: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await setSessionAlias(id, title)
      if (!res.ok) {
        return { ok: false, error: `Gagal menyimpan alias (server ${res.status}).` }
      }
      const clean = title.trim()
      const aliases = { ...this.#state.aliases, [id]: clean }
      const apply = (s: SessionView): SessionView =>
        s.id === id ? { ...s, title: clean, alias: clean } : s
      this.#set({
        aliases,
        sessions: this.#state.sessions.map(apply),
        active: this.#state.active ? apply(this.#state.active) : null,
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Gagal menyimpan alias.' }
    }
  }

  /* Kembalikan judul asli: DELETE alias lalu judul tampil = judul upstream. */
  async restoreSessionTitle(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await deleteSessionAlias(id)
      if (!res.ok) {
        return { ok: false, error: `Gagal mengembalikan judul (server ${res.status}).` }
      }
      const aliases = { ...this.#state.aliases }
      delete aliases[id]
      const apply = (s: SessionView): SessionView =>
        s.id === id ? { ...s, title: s.titleUpstream ?? s.title, alias: null } : s
      this.#set({
        aliases,
        sessions: this.#state.sessions.map(apply),
        active: this.#state.active ? apply(this.#state.active) : null,
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Gagal mengembalikan judul.' }
    }
  }

  /*────────────────────────────────────────────────────────────────────
    Buat sesi dengan inisial (§7.8): POST /api/session {title, model, directory}.
  ─────────────────────────────────────────────────────────────────────*/
  async createAndActivateWithInit(init: { title: string; model?: { id: string; providerID: string }; directory?: string }): Promise<void> {
    const { createSession } = await import('./apiClient')
    const s = await createSession(init)
    await this.loadSessions()
    await this.setActive(s.id)
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
