// src/app/api/chat/route.ts
// Usa OpenRouter con API compatible con OpenAI — sin SDK de Anthropic
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CHAT_TOOLS } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/execute-tool";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

// Modelo a usar en OpenRouter — cambia aquí si quieres otro
// Opciones recomendadas con buen soporte de tool use:
//   "anthropic/claude-sonnet-4-5"
//   "anthropic/claude-3.5-haiku"
//   "openai/gpt-4o"
//   "google/gemini-2.0-flash-001"
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface ORMessage {
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

async function callOpenRouter(messages: ORMessage[], systemPrompt: string) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // Headers opcionales pero recomendados por OpenRouter
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      "X-Title": "CRM Nutrición",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      tools: CHAT_TOOLS,
      tool_choice: "auto",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const role = (session.user as any).role;
  if (role !== "ADMIN") return Response.json({ error: "Solo admins" }, { status: 403 });

  const { messages } = await req.json();
  if (!messages || !Array.isArray(messages))
    return Response.json({ error: "Mensajes requeridos" }, { status: 400 });

  const systemPrompt = await buildSystemPrompt(tenantId);

  // Historial acumulado en formato OpenAI
  let history: ORMessage[] = messages;

  // Primera llamada
  let data = await callOpenRouter(history, systemPrompt);
  let choice = data.choices?.[0];

  // Loop de tool use — el modelo puede encadenar varias tools
  let loopCount = 0;
  while (choice?.finish_reason === "tool_calls" && loopCount < 5) {
    loopCount++;

    const assistantMessage: ORMessage = {
      role: "assistant",
      content: choice.message.content ?? null,
      tool_calls: choice.message.tool_calls,
    };
    history = [...history, assistantMessage];

    // Ejecutar todas las tool calls en paralelo — tenant isolation garantizada
    const toolResults: ORMessage[] = await Promise.all(
      (choice.message.tool_calls ?? []).map(async (toolCall: any) => {
        const args = JSON.parse(toolCall.function.arguments ?? "{}");
        const result = await executeTool(toolCall.function.name, args, tenantId);
        return {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result,
        };
      })
    );

    history = [...history, ...toolResults];

    // Re-llamar con los resultados
    data = await callOpenRouter(history, systemPrompt);
    choice = data.choices?.[0];
  }

  const reply =
    choice?.message?.content ?? "No pude generar una respuesta.";

  return Response.json({ reply });
}
