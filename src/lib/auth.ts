// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
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
      console.log("====== ADAPTER.CREATEUSER CALLED ======", data);
      const defaultTenant = await prisma.tenant.findFirst();
      if (!defaultTenant) {
        console.error("====== ADAPTER.CREATEUSER FAILED: NO TENANT ======");
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
      console.log("====== ADAPTER.CREATEUSER SUCCESS ======", user);
      
      // NextAuth sometimes strictly requires emailVerified to be present
      return { ...user, emailVerified: null } as any;
    } catch (error) {
      console.error("====== ADAPTER.CREATEUSER PRISMA ERROR ======", error);
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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        // 1. Extraer a qué clínica está intentando entrar el usuario leyendo el encabezado Host
        const host = req?.headers?.host || "localhost";
        let tenantIdentifier = "clinica-demo";
        if (host.includes(".localhost")) {
          tenantIdentifier = host.split(".")[0];
        } else if (!host.includes("localhost") && !host.startsWith("www.smartflows")) {
          tenantIdentifier = host;
        }

        // 2. Buscar clínica y bloquear si no existe
        const tenant = await prisma.tenant.findFirst({
           where: { OR: [{ slug: tenantIdentifier }, { customDomain: tenantIdentifier }] }
        });
        if (!tenant) return null;

        // 3. Checar si el usuario REAlMENTE pertenece a ESTA clínica específica
        const user = await prisma.user.findFirst({
          where: { email, tenantId: tenant.id },
        });
        if (!user || !user.passwordHash) return null;
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
        
        if (!isValid) return null;
        
        return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("====== CALLBACK SIGNIN START ======", { userEmail: user?.email, provider: account?.provider });
      
      // Google Calendar tokens now handled by /api/apps/oauth (connected_apps table)
      // No longer need to handle google-calendar provider here

      // 2. Lógica sugerida por Claude para asignar tenantId si por alguna razón faltara
      if (account?.provider === "google") {
        const tenant = await prisma.tenant.findUnique({
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

      console.log("====== CALLBACK SIGNIN END: RETURNING TRUE ======");
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