import type { AIProvider } from "@/stores/settings-store";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIRequestOptions {
  provider: AIProvider;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  systemPrompt: string;
  signal?: AbortSignal;
}

export async function aiChat(opts: AIRequestOptions): Promise<string> {
  if (opts.provider === "claude") {
    return claudeChat(opts);
  }
  return openaiChat(opts);
}

async function claudeChat(opts: AIRequestOptions): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      system: opts.systemPrompt,
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
    signal: opts.signal,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  const textBlock = data.content?.find(
    (b: { type: string }) => b.type === "text",
  );
  return textBlock?.text ?? "";
}

async function openaiChat(opts: AIRequestOptions): Promise<string> {
  const isReasoning = opts.model.startsWith("o");

  const messages = isReasoning
    ? [
        // o-series models use "developer" role instead of "system"
        { role: "developer", content: opts.systemPrompt },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ]
    : [
        { role: "system", content: opts.systemPrompt },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    max_completion_tokens: 4096,
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}
