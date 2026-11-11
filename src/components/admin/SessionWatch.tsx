"use client";
// src/components/admin/SessionWatch.tsx
// Next.js does not run the admin layout again when the user moves between CRM sections, so the server gate
// is only passed on a full page load. This asks for the session on every section change: a user that was
// deactivated, or whose password was reset, leaves the CRM on the next click instead of seeing empty screens.
// It is a convenience for the screen; the APIs are what protect the data (ticket #22).
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { lockedDestination } from "@/lib/account-state";

const SESSION_ENDPOINT = "/api/auth/session";

export default function SessionWatch() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // The layout already checked the account on the server for the first render.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    let isCurrent = true;
    fetch(SESSION_ENDPOINT, { cache: "no-store" })
      .then((res) => res.json())
      .then((snapshot: Record<string, unknown> | null) => {
        const destination = lockedDestination(snapshot);
        if (isCurrent && destination) window.location.href = destination;
      })
      .catch(() => {
        // Offline or a server hiccup: stay on the page. Nothing is exposed, each API still checks the account.
      });
    return () => {
      isCurrent = false;
    };
  }, [pathname]);

  return null;
}
