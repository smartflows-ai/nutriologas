"use client";
import { signIn } from "next-auth/react";

export default function ConnectCalendarButton({ label = "Conectar Google Calendar" }: { label?: string }) {
  return (
    <button
      onClick={() => signIn("google-calendar", { callbackUrl: `${window.location.origin}/admin/calendario` })}
      className="btn-primary flex items-center gap-2 text-sm"
    >
      {label}
    </button>
  );
}
