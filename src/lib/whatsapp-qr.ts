// src/lib/whatsapp-qr.ts
// Pairing QR for the WhatsApp connection. Evolution issues a new code about every 20 seconds, and WhatsApp
// stops after a few. While the owner waits, the stored code is refreshed the same way WhatsApp Web does.
// The issue time and refresh count live in ConnectedApp.metadata (no schema change).
import https from "https";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// A code is valid for about 20 seconds; refresh after 25 seconds to stay just behind it.
export const QR_TTL_MS = 25_000;
// Refreshes allowed before the owner must press "Generar nuevo código" (about 3 minutes).
export const MAX_QR_REFRESHES = 8;

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

function evoFetch(url: string, init?: RequestInit) {
  return fetch(url, { ...(init ?? {}), ...(({ agent: insecureAgent }) as any) });
}

export interface QrMeta {
  qrIssuedAt?: number;
  qrRefreshes?: number;
}

export function qrMetaOf(metadata: unknown): QrMeta {
  return metadata && typeof metadata === "object" ? (metadata as QrMeta) : {};
}

// Current code from Evolution. null when the instance is already open or no code is ready yet.
export async function fetchEvolutionQr(instanceName: string): Promise<string | null> {
  const res = await evoFetch(`${process.env.EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
    method: "GET",
    headers: { apikey: process.env.EVOLUTION_API_KEY! },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.base64 || data.code || null;
}

export async function storeQr(tenantId: string, qrCode: string, metadata: Record<string, unknown>) {
  await prisma.connectedApp.update({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    data: {
      waQrCode: qrCode,
      waStatus: "qr_pending",
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export async function markQrExpired(tenantId: string) {
  await prisma.connectedApp.update({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    data: { waStatus: "qr_expired", waQrCode: null },
  });
}
