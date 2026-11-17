// blockMapper.ts — REST/SSE message → FluxBlock[]. Murni, dapat diuji, ditipkan.
// §0.11 PayloadPerKind wajib ditipkan (tanpa `any`). §0.13 bentuk tak dikenal →
// blok log mentah berjudul `content:<tipe>`, tidak dibuang.

export type FluxKind = 'user' | 'stream' | 'thought' | 'code' | 'command' | 'log' | 'error' | 'diff' | 'limit' | 'research' | 'summary' | 'permission' | 'delete';
export type FluxStatus = 'queued' | 'live' | 'done' | 'error' | 'stopped' | 'reverted';

export interface FluxBlock {
  id: string;
  kind: FluxKind;
  status: FluxStatus;
  startedAt: number;
  endedAt?: number;
  title?: string;
  payload: FluxPayload;
}

export interface PayloadUser { kind: 'user'; text: string; edited: boolean; }
export interface PayloadStream { kind: 'stream'; text: string; live: boolean; }
export interface PayloadThought { kind: 'thought'; text: string; durSec: number; live: boolean; }
export interface CodeLine { n: number; text: string; }
export interface PayloadCode { kind: 'code'; file: string; lines: CodeLine[]; activeLine?: number; live: boolean; }
export interface CommandItem { cmd: string; status: 'queued' | 'live' | 'done' | 'error'; durationMs?: number; }
export interface PayloadCommand { kind: 'command'; items: CommandItem[]; }
export interface LogLine { cls: 'info' | 'warn' | 'error' | 'success' | 'cmd'; text: string; }
export interface PayloadLog { kind: 'log'; title: string; lines: LogLine[]; total: number; }
export interface PayloadError { kind: 'error'; location: string; lines: string[]; }
export interface PayloadLimit { kind: 'limit'; model: string; seconds?: number; }
export interface DiffLine { op: '+' | '-' | ' '; text: string; }
export interface PayloadDiff { kind: 'diff'; lines: DiffLine[]; removed: number; added: number; }
export interface SummarySection { title: string; items: string[]; }
export interface SummarySeal { label: string; ok: boolean; }
export interface PayloadSummary { kind: 'summary'; sections: SummarySection[]; seals: SummarySeal[]; deleted?: { path: string; count: number; backup: string }; }
export interface PayloadResearch { kind: 'research'; title: string; text: string; }
export interface PayloadPermission { kind: 'permission'; requestID: string; tool: string; input: string; status: 'pending' | 'allowed' | 'rejected' | 'expired'; }
export interface PayloadDelete { kind: 'delete'; path: string; }

export type FluxPayload =
  | PayloadUser | PayloadStream | PayloadThought | PayloadCode | PayloadCommand
  | PayloadLog | PayloadError | PayloadLimit | PayloadDiff | PayloadSummary
  | PayloadResearch | PayloadPermission | PayloadDelete;

/*──────────────────────────────────────────────────────────────────────
  Bentuk upstream (sinkron dengan apiClient.ts)
  ──────────────────────────────────────────────────────────────────────*/
type UpMsgTime = { created: number; streamed?: number; completed?: number; ran?: number };
type UpTextPart = { type: 'text'; text: string; };
type UpToolPart = {
  type: 'tool'; id: string; name: string; executed: boolean;
  state: { status: string; input: unknown; content?: UpTextPart[]; metadata?: { status?: string; truncated?: boolean; exit?: number }; time?: UpMsgTime };
  time?: UpMsgTime;
};
type UpReasoningPart = { type: 'reasoning'; text: string; state: { reasoningField: string; reasoningDetails: unknown[] }; };
type UpPart = UpTextPart | UpToolPart | UpReasoningPart;

type UpUser = { id: string; time: UpMsgTime; text: string; type: 'user'; };
type UpAssistant = {
  id: string; time: UpMsgTime; type: 'assistant'; agent?: string;
  model: { id: string; providerID: string };
  content: UpPart[]; finish: string; rawFinish: string;
  tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } };
};
type UpMessage = UpUser | UpAssistant;

/*──────────────────────────────────────────────────────────────────────
  Helpers
  ──────────────────────────────────────────────────────────────────────*/
function isUpUser(m: UpMessage): m is UpUser { return m.type === 'user'; }
function isUpAssistant(m: UpMessage): m is UpAssistant { return m.type === 'assistant'; }

/*──────────────────────────────────────────────────────────────────────
  Pemetaan per bagian konten assistant
  ──────────────────────────────────────────────────────────────────────*/
function mapReasoningPart(part: UpReasoningPart, baseId: string, idx: number, live: boolean): FluxBlock[] {
  const text = part.text?.trim() ?? '';
  const durSec = Math.max(0, Math.round((Date.now() - (live ? 0 : 0)) / 1000)); // placeholder; durasi aktual dari waktu part jika tersedia
  return [{
    id: `${baseId}:reasoning:${idx}`,
    kind: 'thought',
    status: live ? 'live' : 'done',
    startedAt: msOfReasoning(),
    title: 'Thought',
    payload: { kind: 'thought', text, durSec, live },
  }];
}

function msOfReasoning(): number { return Date.now(); }

function mapToolPart(part: UpToolPart, baseId: string, idx: number, live: boolean): FluxBlock[] {
  const { name, state } = part;
  const input = state.input ?? {};
  const inputText = typeof input === 'string' ? input : JSON.stringify(input);
  const status: FluxStatus = live ? 'live' : (state.status === 'completed' || state.status === 'done' ? 'done' : 'queued');
  const durMs = state.time?.completed && state.time?.ran ? state.time.completed - state.time.ran : undefined;

  // read tool → code slab (Explored) jika berisi baris berurut, selainnya log
  if (name === 'read') {
    const content = state.content ?? [];
    const file = (typeof input === 'object' && input && 'path' in input) ? String((input as { path?: unknown }).path) : 'read';
    const lines: CodeLine[] = content.flatMap((c) => c.text.split('\n').map((t, i) => ({ n: i + 1, text: t })));
    return [{
      id: `${baseId}:tool:${idx}`,
      kind: 'code',
      status,
      startedAt: part.time?.created ?? Date.now(),
      title: file,
      payload: { kind: 'code', file, lines, activeLine: undefined, live },
    }];
  }
  // shell / write / edit → command baris
  const cmd = `${name} ${inputText.slice(0, 120)}`;
  return [{
    id: `${baseId}:tool:${idx}`,
    kind: 'command',
    status,
    startedAt: part.time?.created ?? Date.now(),
    endedAt: status === 'done' ? (state.time?.completed) : undefined,
    title: name,
    payload: { kind: 'command', items: [{ cmd, status, durationMs: durMs }] },
  }];
}

/*──────────────────────────────────────────────────────────────────────
  Utama: array pesan REST → FluxBlock[]. Toleran (§0.13).
  ──────────────────────────────────────────────────────────────────────*/
export function mapMessages(messages: UpMessage[]): FluxBlock[] {
  const blocks: FluxBlock[] = [];
  for (const m of messages) {
    if (isUpUser(m)) {
      blocks.push({
        id: `msg:${m.id}`,
        kind: 'user',
        status: 'done',
        startedAt: m.time.created,
        title: 'YOU',
        payload: { kind: 'user', text: m.text, edited: false },
      });
      continue;
    }
    if (!isUpAssistant(m)) continue;

    const live = !m.time.completed && !m.time.streamed;
    const baseId = `msg:${m.id}`;
    let partIndex = 0;
    for (const part of m.content) {
      if (part.type === 'text') {
        const text = part.text?.trim() ?? '';
        if (!text) continue;
        blocks.push({
          id: `${baseId}:text:${partIndex++}`,
          kind: 'stream',
          status: live ? 'live' : 'done',
          startedAt: m.time.created,
          endedAt: m.time.completed,
          payload: { kind: 'stream', text, live },
        });
      } else if (part.type === 'reasoning') {
        blocks.push(...mapReasoningPart(part, baseId, partIndex++, live));
      } else if (part.type === 'tool') {
        blocks.push(...mapToolPart(part, baseId, partIndex++, live));
      } else {
        // §0.13 — bentuk tak dikenal: jangan buang, tampilkan log mentah
        blocks.push({
          id: `${baseId}:unknown:${partIndex++}`,
          kind: 'log',
          status: 'done',
          startedAt: m.time.created,
          title: `content:${String((part as { type?: unknown }).type)}`,
          payload: { kind: 'log', title: `content:${String((part as { type?: unknown }).type)}`, lines: [{ cls: 'info', text: JSON.stringify(part) }], total: 1 },
        });
      }
    }
  }
  return blocks;
}

/*──────────────────────────────────────────────────────────────────────
  Progres sesi (§0.9): blok selesai / total blok run aktif × 100.
  ──────────────────────────────────────────────────────────────────────*/
export function sessionProgress(blocks: FluxBlock[]): number {
  const total = blocks.length;
  if (total === 0) return 0;
  const done = blocks.filter((b) => b.status === 'done').length;
  return Math.round((done / total) * 100);
}

/*──────────────────────────────────────────────────────────────────────
  Konteks §0.15: persen dari tokens ÷ limit.context; unavailable → null
  ──────────────────────────────────────────────────────────────────────*/
export function contextPercent(tokens: { input: number; output: number; reasoning: number } | null | undefined, limitContext: number | null | undefined): number | null {
  if (!tokens || !limitContext || limitContext <= 0) return null;
  const total = tokens.input + tokens.output + tokens.reasoning;
  return Math.min(100, Math.round((total / limitContext) * 100));
}
