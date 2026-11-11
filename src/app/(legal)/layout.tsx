// src/app/(legal)/layout.tsx
// Privacy notice and terms (/privacy, /privacidad, /terms, /terminos). They draw their own NewAigent header and
// footer (LegalPageLayout), so they live outside the storefront group: inside (public) a tenant subdomain would
// get the store navbar and footer on top of them (two navbars).
import SessionProviderWrapper from "@/components/shop/SessionProviderWrapper";

export default function LegalGroupLayout({ children }: { children: React.ReactNode }) {
  return <SessionProviderWrapper>{children}</SessionProviderWrapper>;
}
