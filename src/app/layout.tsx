// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/db";
import { getTenantSlug } from "@/lib/tenant";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/i18n";
import { getTranslationServer } from "@/i18n/server";
import { headers } from "next/headers";
import { Lang } from "@/i18n/types";
import { Toaster } from "sonner";
import { themeColorVars } from "@/lib/theme-vars";
import { tenantPreview } from "@/lib/tenant-metadata";
import { cache } from "react";

const DEFAULT_THEME = {
  primaryColor: "#16a34a",
  secondaryColor: "#15803d",
  accentColor: "#4ade80",
  fontFamily: "Inter, sans-serif",
};

/** First active carousel image, else the first photo of a visible service: the link preview image without a logo. */
async function previewFallbackImage(tenantId: string): Promise<string | null> {
  const [slide, product] = await Promise.all([
    prisma.carouselImage.findFirst({ where: { tenantId, isActive: true }, orderBy: { sortOrder: "asc" }, select: { url: true } }),
    prisma.product.findFirst({
      where: { tenantId, isActive: true, deletedAt: null, NOT: { images: { isEmpty: true } } },
      orderBy: { createdAt: "asc" },
      select: { images: true },
    }),
  ]);
  return slide?.url ?? product?.images[0] ?? null;
}

// One read per request, shared by generateMetadata and the layout (React cache).
const getTenantTheme = cache(async () => {
  const tenantSlug = getTenantSlug();
  try {
    const tenant = tenantSlug
      ? await prisma.tenant.findFirst({
          where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
          include: { theme: true },
        })
      : null;
    const preview = tenant
      ? tenantPreview({
          name: tenant.name,
          slug: tenant.slug,
          customDomain: tenant.customDomain,
          businessInfo: tenant.businessInfo,
          logoUrl: tenant.logoUrl,
          messageLanguage: tenant.messageLanguage,
          fallbackImage: tenant.logoUrl ? null : await previewFallbackImage(tenant.id),
        })
      : null;
    return { name: tenant?.name ?? "NewAigent", theme: tenant?.theme ?? DEFAULT_THEME, preview };
  } catch {
    return { name: "NewAigent", theme: DEFAULT_THEME, preview: null };
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const { preview } = await getTenantTheme();
  const t = getTranslationServer();
  const icons: Metadata["icons"] = {
    icon: [
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  };

  // Marketing page (root domain), or a subdomain with no business behind it.
  if (!preview) {
    return {
      title: "NewAigent",
      description: t.seo.marketingDescription,
      keywords: t.seo.keywords,
      icons,
      manifest: "/favicon/site.webmanifest",
      openGraph: { title: "NewAigent", description: t.seo.marketingDescription, type: "website", url: "https://newaigent.com" },
    };
  }

  // A business page: the preview in the business language, with its address and image (ticket #116).
  const images = preview.image ? [{ url: preview.image }] : undefined;
  return {
    title: preview.title,
    description: preview.description,
    icons,
    manifest: "/favicon/site.webmanifest",
    openGraph: {
      title: preview.title,
      description: preview.description,
      type: "website",
      url: preview.url,
      siteName: preview.title,
      locale: preview.locale,
      images,
    },
    twitter: { card: preview.image ? "summary_large_image" : "summary", title: preview.title, description: preview.description, images: preview.image ? [preview.image] : undefined },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme } = await getTenantTheme();
  
  const headersList = headers();
  const acceptLanguage = headersList.get("accept-language")?.toLowerCase() || "";
  const primaryLang = acceptLanguage.split(",")[0]?.trim() || "";
  const initialLang: Lang = primaryLang.startsWith("es") ? "es" : "en";

  const fFamily = (theme as any)?.fontFamily || "Inter, sans-serif";

  return (
    <html
      lang={initialLang}
      suppressHydrationWarning
      style={{
        ...themeColorVars(theme),
        "--font-family-base": fFamily,
      } as React.CSSProperties}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300"
        style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <LanguageProvider initialLang={initialLang as Lang}>
            {children}
            <Toaster richColors position="top-right" />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
