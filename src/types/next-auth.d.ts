// src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    // Set when the user signed in with a temporary password; the session then has no `user` (src/lib/account-state.ts).
    mustChangePassword?: true;
    user: {
      id: string;
      role: UserRole;
      tenantId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    tenantId: string;
    // Recomputed from the database on every request; never trusted from the cookie.
    access?: "none" | "password_change" | "active";
    // The account's session version at sign-in. Missing in tokens issued before versions existed (counts as 0).
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    tenantId: string;
  }
}
