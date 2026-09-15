// src/lib/ai/openrouter.ts
// Resilient OpenRouter client with prioritized model cascade fallback.
// Automatically falls over to the next model in the stack if a provider is busy, rate-limited, or unavailable.

import { CHAT_TOOLS } from "./tools";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ORMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
  name?: string;
}

export interface CascadeResult {
  data: any;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  attempts: { model: string; status: number | string; error?: string }[];
}

/**
 * Returns the prioritized stack of models to try in order.
 */
export function getModelStack(): string[] {
  const envModels = process.env.OPENROUTER_MODELS;
  if (envModels) {
    const list = envModels
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (list.length > 0) return list;
  }
  if (process.env.OPENROUTER_MODEL) {
    return [process.env.OPENROUTER_MODEL.trim()];
  }
  return [
    "anthropic/claude-sonnet-4.5",
    "openai/gpt-4o",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-4-31b-it:free",
    "openrouter/free",
  ];

}

/**
 * Executes an OpenRouter chat completion request with automatic cascade fallback.
 * 
 * Strategy:
 * 1. OpenRouter Native Fallback: Sends the remaining model stack in the `models` array.
 * 2. Application Loop: If the primary request returns HTTP 429, 500, 502, 503, or 504,
 *    it catches the error and immediately retries with the next model in the stack.
 */
export async function callOpenRouterWithCascade(
  messages: ORMessage[],
  systemPrompt: string,
  options: { maxTokens?: number } = {},
): Promise<CascadeResult> {
  const modelStack = getModelStack();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const maxTokens = options.maxTokens ?? 2048;
  const attempts: { model: string; status: number | string; error?: string }[] = [];

  for (let i = 0; i < modelStack.length; i++) {
    const currentModel = modelStack[i];
    // Remaining models for OpenRouter's internal fallback router
    const fallbackList = modelStack.slice(i);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
          "X-Title": "NewAigent CRM",
        },
        body: JSON.stringify({
          model: currentModel,
          models: fallbackList,
          max_tokens: maxTokens,
          tools: CHAT_TOOLS,
          tool_choice: "auto",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        attempts.push({ model: currentModel, status: res.status, error: errText.slice(0, 150) });

        console.warn(
          `[OpenRouter Cascade] Model ${currentModel} returned HTTP ${res.status}. ${
            i < modelStack.length - 1 ? "Failing over to next model in stack..." : "No more models in stack."
          }`,
        );

        if (i < modelStack.length - 1) {
          continue; // Seamlessly jump to next model in the cascade
        }

        throw new Error(`OpenRouter error (${currentModel}) HTTP ${res.status}: ${errText}`);
      }


      const data = await res.json();
      const modelUsed = data.model ?? currentModel;
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;

      attempts.push({ model: modelUsed, status: "ok" });

      return {
        data,
        modelUsed,
        promptTokens,
        completionTokens,
        attempts,
      };
    } catch (err: any) {
      if (i < modelStack.length - 1) {
        attempts.push({ model: currentModel, status: "error", error: err.message });
        console.warn(`[OpenRouter Cascade] Failed on ${currentModel}: ${err.message}. Retrying with next model...`);
        continue;
      }
      throw err;
    }
  }

  throw new Error("All models in OpenRouter cascade failed.");
}
