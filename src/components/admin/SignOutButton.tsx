"use client";

import { signOut } from "next-auth/react";
import type { ReactNode } from "react";

export default function SignOutButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
    >
      {children}
    </button>
  );
}
