// src/lib/connected-apps.ts
// Central utility for managing connected app tokens (tenant-level).
// Any tool (calendar, AI assistant, etc.) calls getAppToken() — never touches OAuth directly.

import { prisma } from "@/lib/db";
import { AppProvider } from "@prisma/client";

// ── Token refresh configurations per provider ────────────────────────────
const REFRESH_CONFIGS: Record<string, {
  tokenUrl: string;
  buildBody: (refreshToken: string) => Record<string, string>;
}> = {
  GOOGLE: {
    tokenUrl: "https://oauth2.googleapis.com/token",
    buildBody: (refreshToken) => ({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  },
  MICROSOFT: {
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    buildBody: (refreshToken) => ({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "Calendars.Read Mail.Read offline_access",
    }),
  },
};

/**
 * Get a valid access token for the given tenant + provider.
 * Automatically refreshes if expired. Returns null if not connected.
 */
export async function getAppToken(
  tenantId: string,
  provider: AppProvider
): Promise<string | null> {
  const app = await prisma.connectedApp.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });

  if (!app) return null;

  // Token still valid — return it
  if (!app.tokenExpiry || new Date() < app.tokenExpiry) {
    return app.accessToken;
  }

  // Token expired — try refresh
  if (!app.refreshToken) return null;

  const config = REFRESH_CONFIGS[provider];
  if (!config) return null;

  try {
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(config.buildBody(app.refreshToken)).toString(),
    });

    if (!res.ok) {
      console.error(`[connected-apps] Failed to refresh ${provider} token:`, await res.text());
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.access_token as string;
    const expiresIn = data.expires_in as number | undefined;

    await prisma.connectedApp.update({
      where: { id: app.id },
      data: {
        accessToken: newAccessToken,
        // Some providers also return a new refresh token
        ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
        tokenExpiry: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      },
    });

    return newAccessToken;
  } catch (err) {
    console.error(`[connected-apps] Error refreshing ${provider} token:`, err);
    return null;
  }
}

/**
 * Save (upsert) a connected app record.
 */
export async function saveAppConnection(
  tenantId: string,
  provider: AppProvider,
  tokens: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    scopes?: string | null;
  },
  connectedByUserId?: string
) {
  return prisma.connectedApp.upsert({
    where: { tenantId_provider: { tenantId, provider } },
    create: {
      tenantId,
      provider,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiry: tokens.expiresAt ?? null,
      scopes: tokens.scopes ?? null,
      connectedByUserId: connectedByUserId ?? null,
    },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? undefined,
      tokenExpiry: tokens.expiresAt ?? undefined,
      scopes: tokens.scopes ?? undefined,
      connectedByUserId: connectedByUserId ?? undefined,
      connectedAt: new Date(),
    },
  });
}

/**
 * Find which provider is connected for a given set of options.
 * Useful when a tool (e.g. calendar) supports multiple providers.
 */
export async function getConnectedProvider(
  tenantId: string,
  providers: AppProvider[]
): Promise<AppProvider | null> {
  const app = await prisma.connectedApp.findFirst({
    where: { tenantId, provider: { in: providers } },
    select: { provider: true },
  });
  return app?.provider ?? null;
}
