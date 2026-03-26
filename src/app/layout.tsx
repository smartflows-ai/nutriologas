// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/db";
import { getTenantSlug } from "@/lib/tenant";
import { ThemeProvider } from "@/components/ThemeProvider";

// El tenant se resuelve en v1 con el slug por defecto.
// En v2 se resolverá desde el subdominio via middleware.
async function getTenantTheme() {
  const tenantSlug = getTenantSlug();

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
      include: { theme: true },
    });
    return {
      name: tenant?.name ?? "Clínica Nutrición",
      theme: tenant?.theme ?? { primaryColor: "#16a34a", secondaryColor: "#15803d", accentColor: "#4ade80" },
    };
  } catch {
    return { name: "Clínica Nutrición", theme: { primaryColor: "#16a34a", secondaryColor: "#15803d", accentColor: "#4ade80" } };
  }
}

export const metadata: Metadata = {
  title: "Clínica Nutrición",
  description: "Tu clínica de nutrición de confianza",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { name, theme } = await getTenantTheme();

  return (
    <html
      lang="es"
      suppressHydrationWarning
      style={{
        "--color-primary": theme.primaryColor,
        "--color-secondary": theme.secondaryColor,
        "--color-accent": theme.accentColor,
      } as React.CSSProperties}
    >
      <head>
        <title>{name}</title>
      </head>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
