// Data layer — flux-webui N4. Semua path relatif ke adapter (127.0.0.1:28572)
// yang memproxy ke upstream OpenCode. Tidak ada dependensi baru; fetch murni.
// Hard constants tercatat di sini dengan file:line untuk laporan acceptance.

export const PAGE_SIZE = 50; // §0.17 — halaman 50 pesan, order/limit/cursor eksplisit
export const DEBOUNCE_ACTIVE_MS = 300; // §0.2 — refetch saat run aktif
export const DEBOUNCE_IDLE_MS = 400; // §0.2 — refetch saat idle

type Json = unknown;

async function request(path: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json', ...opts.headers },
      ...opts,
      signal: opts.signal ?? controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(res: Response): Promise<{ ok: boolean; status: number; data: Json }> {
  let data: Json = null;
  try {
    data = await res.json().catch(() => null);
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

/*──────────────────────────────────────────────────────────────────────
  Model / bentuk upstream (ditemukan discovery N4, lihat laporan)
  ─────────────────────────────────────────────────────────────────────*/
export interface Session {
  id: string;
  projectID?: string;
  title?: string;
  location?: { directory: string };
  agent?: string;
  model?: { id: string; providerID: string; variant?: string };
  tokens?: { input: number; output: number; reasoning: number; cache: { read: number; write: number } };
  cost?: number;
  outcome?: string;
  time?: { created: number; updated?: number; idle?: number };
}

export interface MessageTime { created: number; streamed?: number; completed?: number; ran?: number; }

export interface UserMessage {
  id: string;
  time: MessageTime;
  text: string;
  type: 'user';
}

export interface ContentPartText { type: 'text'; text: string; }
export interface ContentPartTool {
  type: 'tool';
  id: string;
  name: string;
  executed: boolean;
  state: { status: string; input: Json; content?: ContentPartText[]; metadata?: { status?: string; truncated?: boolean; exit?: number }; time?: MessageTime };
  time?: MessageTime;
}
export interface ContentPartReasoning { type: 'reasoning'; text: string; state: { reasoningField: string; reasoningDetails: Json[] }; }

export interface AssistantMessage {
  id: string;
  time: MessageTime;
  type: 'assistant';
  agent?: string;
  model: { id: string; providerID: string };
  content: (ContentPartText | ContentPartTool | ContentPartReasoning)[];
  finish: string;
  rawFinish: string;
  cost: number;
  tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } };
}

export type Message = UserMessage | AssistantMessage;

export interface MessagesPage {
  data: Message[];
  cursor: { previous: string | null; next: string | null };
}

export interface ModelDefault {
  data: { id: string; modelID: string; providerID: string; name: string; limit: { context: number; output: number }; };
}

/*──────────────────────────────────────────────────────────────────────
  Endpoints (discovery N4, semua dibuktikan terhadap upstream nyata)
  ──────────────────────────────────────────────────────────────────────*/

export async function listSessions(limit = 50): Promise<Session[]> {
  const res = await request(`/api/session?limit=${encodeURIComponent(String(limit))}`);
  const json = await readJson(res);
  if (!json.ok) throw new Error(`listSessions ${json.status}`);
  return (json.data as { data: Session[] }).data ?? [];
}

export async function getSession(id: string): Promise<Session> {
  const res = await request(`/api/session/${encodeURIComponent(id)}`);
  const json = await readJson(res);
  if (!json.ok) throw new Error(`getSession ${json.status}`);
  return json.data as Session;
}

export async function getMessages(sessionID: string, limit: number, order: 'asc' | 'desc' = 'asc', cursor?: string | null): Promise<MessagesPage> {
  let url = `/api/session/${encodeURIComponent(sessionID)}/message?limit=${encodeURIComponent(String(limit))}&order=${order}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await request(url);
  const json = await readJson(res);
  if (!json.ok) throw new Error(`getMessages ${json.status}`);
  return json.data as MessagesPage;
}

export async function createSession(init?: { title?: string; model?: { id: string; providerID: string; variant?: string }; directory?: string }): Promise<Session> {
  const res = await request('/api/session', {
    method: 'POST',
    body: JSON.stringify(init ?? {}),
    headers: { 'content-type': 'application/json' },
  });
  const json = await readJson(res);
  if (!json.ok) throw new Error(`createSession ${json.status}`);
  return (json.data as { data: Session }).data;
}

export async function deleteSession(id: string): Promise<{ ok: boolean; status: number }> {
  const res = await request(`/api/session/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return { ok: res.ok, status: res.status };
}

/* Alias judul lokal (N4.4.4) — disimpan adapter flux-webui sendiri di
   <stateDir>/session-aliases.json. Upstream tidak punya endpoint ganti judul
   (PATCH/PUT/POST /api/session/:id → 404, dibuktikan discovery N4.4), jadi
   alias adalah satu-satunya jalur rename — judul upstream/CLI tidak berubah. */
export async function getSessionAliases(): Promise<Record<string, string>> {
  const res = await request('/api/session-alias');
  const json = await readJson(res);
  if (!json.ok) throw new Error(`getSessionAliases ${json.status}`);
  const aliases = (json.data as { aliases?: Record<string, string> })?.aliases;
  return aliases && typeof aliases === 'object' ? aliases : {};
}

export async function setSessionAlias(sessionID: string, title: string): Promise<{ ok: boolean; status: number }> {
  const res = await request(`/api/session-alias/${encodeURIComponent(sessionID)}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
    headers: { 'content-type': 'application/json' },
  });
  return { ok: res.ok, status: res.status };
}

export async function deleteSessionAlias(sessionID: string): Promise<{ ok: boolean; status: number }> {
  const res = await request(`/api/session-alias/${encodeURIComponent(sessionID)}`, { method: 'DELETE' });
  return { ok: res.ok, status: res.status };
}

export interface PermissionRule { id: string; action: string; resource: string; effect?: string; }

export async function getPermissionSaved(): Promise<PermissionRule[]> {
  const res = await request('/api/permission/saved');
  const json = await readJson(res);
  if (!json.ok) throw new Error(`getPermissionSaved ${json.status}`);
  return (json.data as { data: PermissionRule[] }).data ?? [];
}

export async function getModelList(): Promise<ModelDefault['data'][]> {
  const res = await request('/api/model');
  const json = await readJson(res);
  if (!json.ok) throw new Error(`getModelList ${json.status}`);
  return (json.data as { data: ModelDefault['data'][] }).data ?? [];
}

export async function sendPrompt(sessionID: string, text: string): Promise<{ ok: boolean }> {
  const res = await request(`/api/session/${encodeURIComponent(sessionID)}/prompt`, {
    method: 'POST',
    body: JSON.stringify({ text }),
    headers: { 'content-type': 'application/json' },
  });
  return { ok: res.ok };
}

export async function interruptSession(sessionID: string): Promise<{ ok: boolean }> {
  const res = await request(`/api/session/${encodeURIComponent(sessionID)}/interrupt`, { method: 'POST' });
  return { ok: res.ok };
}

export async function getModelDefault(): Promise<ModelDefault> {
  const res = await request('/api/model/default');
  const json = await readJson(res);
  if (!json.ok) throw new Error(`getModelDefault ${json.status}`);
  return json.data as ModelDefault;
}

/*──────────────────────────────────────────────────────────────────────
  Permission reply (§0.3) & revert (§0.14)
  ──────────────────────────────────────────────────────────────────────*/
export type PermissionReply = 'accept' | 'reject' | 'always' | 'once';

export async function replyPermission(sessionID: string, requestID: string, reply: PermissionReply, message = ''): Promise<{ ok: boolean }> {
  const res = await request(`/api/session/${encodeURIComponent(sessionID)}/permission/${encodeURIComponent(requestID)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ reply, message }),
    headers: { 'content-type': 'application/json' },
  });
  return { ok: res.ok };
}

export async function revertStage(messageID: string): Promise<{ ok: boolean }> {
  const res = await request('/revert/stage', {
    method: 'POST',
    body: JSON.stringify({ messageID }),
    headers: { 'content-type': 'application/json' },
  });
  return { ok: res.ok };
}

export async function revertClear(): Promise<{ ok: boolean }> {
  const res = await request('/revert/clear', { method: 'POST' });
  return { ok: res.ok };
}

export async function revertCommit(): Promise<{ ok: boolean }> {
  const res = await request('/revert/commit', { method: 'POST' });
  return { ok: res.ok };
}

/*──────────────────────────────────────────────────────────────────────
  Auth state (digunakan Gate)
  ──────────────────────────────────────────────────────────────────────*/
export interface AuthState { state: 'ready' | 'setup-required'; }

export async function getAuthState(): Promise<AuthState> {
  const res = await request('/api/auth/state');
  const json = await readJson(res);
  return { state: ((json.data as { state?: string })?.state === 'ready' ? 'ready' : 'setup-required') };
}

export async function setupPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await request('/setup', { method: 'POST', body: JSON.stringify({ password }), headers: { 'content-type': 'application/json' } });
  const json = await readJson(res);
  return { ok: res.ok, error: (json.data as { error?: string })?.error };
}

export async function loginPassword(password: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await request('/login', { method: 'POST', body: JSON.stringify({ password }), headers: { 'content-type': 'application/json' } });
  const json = await readJson(res);
  return { ok: res.ok, status: res.status, error: (json.data as { error?: string })?.error };
}

export async function logout(): Promise<void> {
  await request('/logout', { method: 'POST' });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
    headers: { 'content-type': 'application/json' },
  });
  const json = await readJson(res);
  return { ok: res.ok, status: res.status, error: (json.data as { error?: string })?.error };
}
