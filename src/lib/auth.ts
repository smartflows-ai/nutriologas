// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import { headers } from "next/headers";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// Cookie domain for subdomain sharing.
// In dev: ".localhost" so doctor.localhost:3000 shares cookies with localhost:3000
// In prod: ".yourdomain.com" so tenant.yourdomain.com works
const useSecureCookies = process.env.NODE_ENV === "production";
// In dev: no domain → host-specific cookie per subdomain (Chrome rejects Domain=.localhost)
// In prod: wildcard domain so all subdomains share the session
const cookieDomain = process.env.NODE_ENV === "production"
  ? `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com"}`
  : undefined;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: useSecureCookies ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
    },
    callbackUrl: {
      name: useSecureCookies ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
    },
    csrfToken: {
      name: useSecureCookies ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  adapter: {
    ...PrismaAdapter(prisma),
    getUserByEmail: async (email) => {
      const user = await prisma.user.findFirst({ where: { email } });
      return user ? (user as any) : null;
    },
    getUserByAccount: async ({ providerAccountId, provider }) => {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { providerAccountId, provider } },
        select: { user: true },
      });
      return account?.user ? (account.user as any) : null;
    },
    createUser: async (data: any) => {
      const defaultTenant = await prisma.tenant.findFirst();
      if (!defaultTenant) {
        throw new Error("No hay un tenant configurado en la BD.");
      }

      try {
        const user = await prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
            image: data.image,
            tenantId: defaultTenant.id,
          },
        });
        // NextAuth sometimes strictly requires emailVerified to be present
        return { ...user, emailVerified: null } as any;
      } catch (error) {
        throw error;
      }
    },
    updateUser: async (data: any) => {
      const user = await prisma.user.update({
        where: { id: data.id },
        data: {
          name: data.name,
          email: data.email,
          image: data.image,
        },
      });
      return user as any;
    },
  },
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: any, req) {
        console.log("[AUTH] ===== authorize() called =====");
        if (!credentials?.email || !credentials?.password) {
          console.log("[AUTH] Missing email or password");
          return null;
        }
        const email = credentials.email.trim().toLowerCase();

        const headersList = headers();
        const host = (headersList.get("host") || req?.headers?.host || "localhost").toLowerCase();
        const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com").toLowerCase();

        let tenantIdentifier: string;
        if (host.endsWith(".localhost:3000") || host.endsWith(".localhost")) {
          tenantIdentifier = host.split(".")[0];
        } else if (host.endsWith(`.${rootDomain}`)) {
          tenantIdentifier = host.replace(`.${rootDomain}`, "");
        } else if (host === rootDomain || host === `www.${rootDomain}` || host.startsWith("localhost")) {
          tenantIdentifier = "";
        } else {
          tenantIdentifier = host.split(":")[0];
        }
        console.log("[AUTH] Tenant identifier:", tenantIdentifier);

        // 2. Buscar clínica y bloquear si no existe
        let tenant = await prisma.tenant.findFirst({
          where: { OR: [{ slug: tenantIdentifier }, { customDomain: tenantIdentifier }] }
        });

        if (!tenant) {
          console.warn(`[AUTH] Tenant NOT found for: ${tenantIdentifier} (host: ${host})`);
          return null;
        }
        console.log("[AUTH] Tenant found:", tenant.id, tenant.name);

        const user = await prisma.user.findFirst({
          where: { email, tenantId: tenant.id },
        });
        if (!user || !user.passwordHash) return null;
        let isValid = false;
        if (
          user.passwordHash.startsWith("$2a$") ||
          user.passwordHash.startsWith("$2b$") ||
          user.passwordHash.startsWith("$2y$")
        ) {
          isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        } else {
          const isPlainMatch = user.passwordHash === credentials.password;
          const isHashedMatch = user.passwordHash === `hashed_${credentials.password}`;
          isValid = isPlainMatch || isHashedMatch;
        }

        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        let tenant = await prisma.tenant.findUnique({
          where: { slug: "clinica-demo" },
        });
        if (!tenant) return false;

        const existing = await prisma.user.findFirst({
          where: { email: user.email! },
        });

        if (existing && (!existing.tenantId || !existing.role)) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { tenantId: tenant.id, role: "CUSTOMER" },
          });
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
      }

      if (!token.tenantId && token.email) {
        const dbUser = await prisma.user.findFirst({
          where: { email: token.email as string },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      try {
        const targetUrl = new URL(url);
        const base = new URL(baseUrl);
        if (
          targetUrl.port === base.port &&
          (targetUrl.hostname === base.hostname ||
            targetUrl.hostname.endsWith(`.${base.hostname}`))
        ) {
          return url;
        }
      } catch { }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};