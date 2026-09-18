// src/app/api/chat/route.ts
// Usa OpenRouter con API compatible con OpenAI — sin SDK de Anthropic
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CHAT_TOOLS } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/execute-tool";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { enforceCredits, recordTokenUsage, getOrCreateLedger } from "@/lib/credits";
import { CreditExhaustedError } from "@/lib/credits-error";
import { prisma } from "@/lib/db";

import { callOpenRouterWithCascade, ORMessage } from "@/lib/ai/openrouter";


export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const role = (session.user as any).role;
  if (role !== "ADMIN") return Response.json({ error: "Solo admins" }, { status: 403 });

  // ── Resolve tenant plan for credit limit lookup ──────────────────────────
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  });
  const planId = (sub?.plan as string) ?? "STARTER";

  // Ensure ledger exists for this period
  await getOrCreateLedger(tenantId, planId);

  // ── Credit enforcement: block if exhausted ───────────────────────────────
  try {
    await enforceCredits(tenantId, planId);
  } catch (err) {
    if (err instanceof CreditExhaustedError) {
      return Response.json(
        {
          error: "credit_exhausted",
          usedUsd: err.usedUsd,
          limitUsd: err.limitUsd,
        },
        { status: 402 },
      );
    }
    throw err;
  }

  const { messages } = await req.json();
  if (!messages || !Array.isArray(messages))
    return Response.json({ error: "Mensajes requeridos" }, { status: 400 });

  const systemPrompt = await buildSystemPrompt(tenantId);

  // Historial acumulado en formato OpenAI
  let history: ORMessage[] = messages;

  // Accumulate token usage across all loop iterations
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let lastModelUsed = "anthropic/claude-3.5-sonnet";

  try {
    // Primera llamada a través del cascade stack
    let cascadeRes = await callOpenRouterWithCascade(history, systemPrompt);
    let data = cascadeRes.data;
    lastModelUsed = cascadeRes.modelUsed;
    let choice = data.choices?.[0];

    totalPromptTokens += cascadeRes.promptTokens;
    totalCompletionTokens += cascadeRes.completionTokens;

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

      // Re-llamar a través del cascade
      cascadeRes = await callOpenRouterWithCascade(history, systemPrompt);
      data = cascadeRes.data;
      lastModelUsed = cascadeRes.modelUsed;
      choice = data.choices?.[0];

      totalPromptTokens += cascadeRes.promptTokens;
      totalCompletionTokens += cascadeRes.completionTokens;
    }

    // ── Record token usage atomically and capture updated creditStatus ─────
    let updatedCreditStatus = null;
    if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
      try {
        updatedCreditStatus = await recordTokenUsage(
          tenantId,
          totalPromptTokens,
          totalCompletionTokens,
          planId,
          lastModelUsed,
        );
      } catch (e) {
        console.error("[chat] Failed to record token usage:", e);
      }
    }

    const reply =
      choice?.message?.content ?? "No pude generar una respuesta.";

    return Response.json({
      reply,
      modelUsed: "Newy AI",
      creditStatus: updatedCreditStatus,
    });

  } catch (err: any) {
    console.error("[api/chat] Error during chat completion:", err);
    return Response.json(
      { error: err.message ?? "Error al comunicarse con el asistente de IA" },
      { status: 500 },
    );
  }
}

