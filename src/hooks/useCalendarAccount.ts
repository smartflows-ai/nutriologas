// src/hooks/useCalendarAccount.ts
// The external calendar linked to the business and its account email, for the CRM screens that show it.
"use client";

import { useEffect, useState } from "react";

export interface CalendarAccountInfo {
  provider: "GOOGLE" | "MICROSOFT";
  email: string | null;
}

/** `null` while loading or when no calendar is linked; `email` is null if the provider could not be read. */
export function useCalendarAccount(): CalendarAccountInfo | null {
  const [account, setAccount] = useState<CalendarAccountInfo | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/calendar/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore) setAccount(data?.account ?? null);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  return account;
}
