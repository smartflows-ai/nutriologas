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
const cookieDomain = process.env.NODE_ENV === "production"
  ? `.${new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000").hostname.replace(/^www\./, "")}`
  : ".localhost";

export const authOptions: NextAuthOptions = {
  cookies: {
    sessionToken: {
      name: useSecureCookies ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: cookieDomain,
      },
    },
    callbackUrl: {
      name: useSecureCookies ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: cookieDomain,
      },
    },
    csrfToken: {
      name: useSecureCookies ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        // NOTE: csrfToken does NOT get a domain — it must be host-only for security
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

        // 1. Extraer a qué clínica está intentando entrar el usuario leyendo el encabezado Host
        let host = "localhost";
        try {
          const headersList = headers();
          host = headersList.get("host") || "localhost";
        } catch {
          // headers() may throw in some contexts, fall back to req
          host = req?.headers?.host || "localhost";
        }
        console.log("[AUTH] Host:", host, "| Email:", email);

        let tenantIdentifier = "clinica-demo";
        if (host.includes(".localhost")) {
          tenantIdentifier = host.split(".")[0];
        } else if (!host.includes("localhost") && !host.startsWith("www.smartflows")) {
          tenantIdentifier = host;
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

        // 3. Checar si el usuario REALMENTE pertenece a ESTA clínica específica
        const user = await prisma.user.findFirst({
          where: { email, tenantId: tenant.id },
        });
        if (!user) {
          console.log("[AUTH] User NOT found for email:", email, "in tenant:", tenant.id);
          return null;
        }
        if (!user.passwordHash) {
          console.log("[AUTH] User has no passwordHash:", email);
          return null;
        }
        console.log("[AUTH] User found:", user.id, user.email, "| hash starts with:", user.passwordHash.substring(0, 4));

        // Usar bcrypt si el hash tiene el formato estándar (empieza con $2), si no retrocompatibilidad
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

        if (!isValid) {
          console.log("[AUTH] Password INVALID for:", email);
          return null;
        }

        console.log("[AUTH] Login SUCCESS for:", email, "tenant:", tenant.id);
        return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Google Calendar tokens now handled by /api/apps/oauth (connected_apps table)
      // No longer need to handle google-calendar provider here

      // 2. Lógica sugerida por Claude para asignar tenantId si por alguna razón faltara
      if (account?.provider === "google") {
        let tenant = await prisma.tenant.findUnique({
          where: { slug: "clinica-demo" },
        });
        if (!tenant) return false;

        const existing = await prisma.user.findFirst({
          where: { email: user.email! },
        });

        // Si existe pero mágicamente no tiene tenantId o role, se lo asignamos
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
      
      // Failsafe sugerido por Claude: Si el token no tiene tenantId, forzamos buscarlo en la DB
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
      // Allow relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow same origin
      if (url.startsWith(baseUrl)) return url;
      // Allow localhost subdomains (e.g. doctor.localhost:3000, nutri.localhost:3000)
      try {
        const targetUrl = new URL(url);
        const base = new URL(baseUrl);
        // Same port, and target hostname ends with base hostname (subdomain match)
        if (
          targetUrl.port === base.port &&
          (targetUrl.hostname === base.hostname ||
            targetUrl.hostname.endsWith(`.${base.hostname}`))
        ) {
          return url;
        }
      } catch {}
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};