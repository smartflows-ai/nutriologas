"use client";
// src/components/admin/team/useTeam.ts
// Data and actions of the team screen: load the team, and reset, deactivate or activate one user.
// One action at a time: a second click while a request is in flight is ignored, so a password is never
// reset twice (the first temporary password would already be invalid when the dialog shows it).
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/useToast";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import { LOGIN_PATH } from "@/lib/account-state";
import type { StaffUser, TeamOverview } from "@/lib/staff-users";

export type TeamAction = "reset_password" | "deactivate" | "activate";

const TEAM_ENDPOINT = "/api/admin/users";
const UNAUTHORIZED = 401;

interface ActionOutcome {
  // Set only after a password reset: shown once by the caller and never stored here.
  tempPassword?: string;
  isDone: boolean;
}

export function useTeam() {
  const { t } = useTranslation();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  // Refs, not state: they must be read in the same tick as the click that changes them.
  const isRunning = useRef(false);
  const latestLoad = useRef(0);

  // The owner's own session ended (signed out elsewhere, or the account changed): back to login.
  const leaveIfSignedOut = (status: number): boolean => {
    if (status !== UNAUTHORIZED) return false;
    window.location.href = LOGIN_PATH;
    return true;
  };

  const load = useCallback(async () => {
    const requestId = ++latestLoad.current;
    try {
      const res = await fetch(TEAM_ENDPOINT, { cache: "no-store" });
      if (leaveIfSignedOut(res.status)) return;
      if (!res.ok) throw new Error("team_load_failed");
      const overview = (await res.json()) as TeamOverview;
      // An older answer must not overwrite a newer one.
      if (requestId !== latestLoad.current) return;
      setTeam(overview);
      setHasLoadError(false);
    } catch {
      if (requestId === latestLoad.current) setHasLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (user: StaffUser, action: TeamAction): Promise<ActionOutcome> => {
    if (isRunning.current) return { isDone: false };
    isRunning.current = true;
    setIsBusy(true);
    try {
      const res = await fetch(`${TEAM_ENDPOINT}/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (leaveIfSignedOut(res.status)) return { isDone: false };
      const data: { error?: string; tempPassword?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(translateApiError(t, data.error ?? "internal_error") ?? "");
        return { isDone: false };
      }
      await load();
      return { isDone: true, tempPassword: data.tempPassword };
    } catch {
      toast(translateApiError(t, "internal_error") ?? "");
      return { isDone: false };
    } finally {
      isRunning.current = false;
      setIsBusy(false);
    }
  };

  return { team, hasLoadError, isBusy, load, run };
}
