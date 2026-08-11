/**
 * Vercel serverless function powering the landing's interactive demo.
 *
 * The site itself is a fully static Astro build; this single function is the
 * only server-side surface (Vercel picks up `/api/*` automatically, no adapter
 * needed). It runs the demo agent loop so the Anthropic API key never reaches
 * the browser. In non-Vercel environments (e.g. the self-hosted Docker stack)
 * this route does not exist and the client degrades gracefully.
 */
import { isDemoConfigured, runDemo, type ChatTurn } from '../src/lib/demo/agent';

export const config = { runtime: 'nodejs' };

const MAX_TURNS = 8; // conversation length the client may send
const MAX_CHARS = 600; // per message
const RATE_LIMIT = 8; // requests
const RATE_WINDOW_MS = 60_000; // per minute, per IP (best-effort, per instance)

// Best-effort limiter. Serverless instances are ephemeral so this is not a hard
// guarantee — the real cost ceiling is the per-request turn/token cap in the
// agent. A KV-backed limiter (Vercel KV / Upstash) is the production upgrade.
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function parseTurns(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TURNS) {
    return null;
  }
  const turns: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const role = (item as { role?: unknown }).role;
    const text = (item as { text?: unknown }).text;
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_CHARS) return null;
    turns.push({ role, text: trimmed });
  }
  // Must be a real conversation ending on a user question.
  if (turns[turns.length - 1].role !== 'user') return null;
  return turns;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request): Promise<Response> {
  if (!isDemoConfigured()) {
    return json(
      {
        error: 'demo_unavailable',
        message:
          'The live demo is not configured in this environment. Request a private demo instead.',
      },
      503,
    );
  }

  if (rateLimited(clientIp(request))) {
    return json(
      { error: 'rate_limited', message: 'Too many requests. Try again in a minute.' },
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON body.' }, 400);
  }

  const turns = parseTurns((payload as { messages?: unknown })?.messages);
  if (!turns) {
    return json(
      { error: 'bad_request', message: 'Provide 1-8 messages of up to 600 chars each.' },
      400,
    );
  }

  try {
    const result = await runDemo(turns);
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'demo_not_configured') {
      return json({ error: 'demo_unavailable' }, 503);
    }
    // Never leak internal errors / keys to the client.
    console.error('[demo] agent error:', message);
    return json(
      { error: 'agent_error', message: 'The demo could not answer that. Try again.' },
      502,
    );
  }
}
