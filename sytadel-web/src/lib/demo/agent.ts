/**
 * The demo's server-side agentic loop. Given a short conversation, it lets
 * Claude drive the Sytadel demo tools (the same registry the MCP server
 * exposes) and returns the final answer plus a trace of every tool call so the
 * UI can show what the model actually did.
 *
 * This runs ONLY on the server (Vercel function). The Anthropic API key never
 * reaches the browser. Hard caps on turns, tokens and history keep a public,
 * unauthenticated endpoint from turning into an open, expensive LLM proxy.
 */
import Anthropic from '@anthropic-ai/sdk';

import { DEMO_TENANT } from './fixtures';
import { DEMO_TOOLS, findDemoTool } from './tools';

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export type ToolCallTrace = {
  name: string;
  input: Record<string, unknown>;
  result: unknown;
};

export type DemoResult = {
  reply: string;
  toolCalls: ToolCallTrace[];
  truncated: boolean;
};

const MAX_TURNS = 5; // tool-use iterations per request
const MAX_TOKENS = 1024;
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are the Sytadel demo assistant on the sytadel-labs.com marketing site.

Sytadel is an identity + Zero Trust security platform. You are connected — via MCP-style tools — to a small, fictional, READ-ONLY demo tenant called "${DEMO_TENANT.name}". Use the tools to answer questions about that tenant's users, service accounts, session anomalies, RBAC policies and access posture.

Rules:
- Prefer calling a tool over guessing. Ground every claim in tool output.
- This is a sandbox with seeded data; never imply it is a real customer.
- You can only READ. If asked to change, revoke, apply a policy or approve access, explain that the demo is read-only and describe what the real platform would do.
- Be concise and specific. Surface concrete findings (names, roles, dates) and, when relevant, the security implication.
- Politely decline questions unrelated to Sytadel or this demo tenant.`;

const ANTHROPIC_TOOLS: Anthropic.Tool[] = DEMO_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema as Anthropic.Tool.InputSchema,
}));

export function isDemoConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function runDemo(turns: ChatTurn[]): Promise<DemoResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('demo_not_configured');
  }

  const client = new Anthropic({ apiKey, timeout: 25_000 });
  const model = process.env.DEMO_MODEL ?? DEFAULT_MODEL;

  const messages: Anthropic.MessageParam[] = turns.map((t) => ({
    role: t.role,
    content: t.text,
  }));

  const toolCalls: ToolCallTrace[] = [];

  for (let i = 0; i < MAX_TURNS; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: ANTHROPIC_TOOLS,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { reply: textOf(response.content), toolCalls, truncated: false };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const input = (use.input ?? {}) as Record<string, unknown>;
      const tool = findDemoTool(use.name);
      const result = tool
        ? tool.run(input)
        : { error: `Unknown tool: ${use.name}` };
      toolCalls.push({ name: use.name, input, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    reply:
      'The demo hit its step limit for this turn. Ask a more focused question, or request a private demo to see the full flow.',
    toolCalls,
    truncated: true,
  };
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
