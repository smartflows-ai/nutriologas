"use client";

import { signOut } from "next-auth/react";
import type { ReactNode } from "react";

export default function SignOutButton({ children, iconOnly }: { children: ReactNode; iconOnly?: boolean }) {
  return (
    <button
      type="button"
      onClick={async () => { await signOut({ redirect: false }); window.location.href = "/login"; }}
      className={`flex items-center w-full rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors ${iconOnly ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"}`}
      title={iconOnly ? "Cerrar sesión" : undefined}
    >
      {children}
    </button>
  );
}
