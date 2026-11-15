// src/lib/api-errors.ts
// Error responses for customer-facing API routes. The body carries a code, and the UI translates it
// through t.apiErrors (see translateApiError in src/i18n/validation.ts).
import { NextResponse } from "next/server";
import type { Translations } from "@/i18n/types";

export type ApiErrorCode = keyof Translations["apiErrors"];

export function apiError(code: ApiErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status });
}

/** Same as apiError, with extra data the screen needs (for example the free times offered when a slot is taken). */
export function apiErrorWith(code: ApiErrorCode, status: number, extra: Record<string, unknown>) {
  return NextResponse.json({ ...extra, error: code }, { status });
}
