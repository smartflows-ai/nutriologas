// src/app/api/internal/render-post-banner/route.ts
// Internal API endpoint for n8n to render marketing post banners with:
// - Background photo (from user catalog or AI generation)
// - Deep, smooth gradient bottom scrim for 100% guaranteed text readability on any background
// - High-contrast hero title with optional accent highlight
// - Support value proposition text
// - Rounded CTA pill button in accent color with proper padding
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret") || req.headers.get("x-internal-key");
  if (!secret || secret !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      imageUrl,
      tenantId,
      hero,
      heroHighlight,
      support,
      cta,
      accentColor = "#00C853",
    } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    // Escape XML special characters to prevent invalid SVG markup
    const escapeXml = (str?: string) => {
      if (!str || typeof str !== "string") return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
        .trim();
    };

    const cleanHero = escapeXml(hero) || "Promoción Especial";
    const cleanHighlight = escapeXml(heroHighlight);
    const cleanSupport = escapeXml(support);
    const cleanCta = escapeXml(cta) || "Agenda ahora";
    const cleanColor = /^#[0-9A-Fa-f]{6}$/.test(accentColor) ? accentColor : "#00C853";

    // Target storage folder per tenant
    const targetFolder = tenantId
      ? `nutriologas/${tenantId}/campaigns`
      : "nutriologas/campaigns";

    // Compute CTA pill button dimensions with generous horizontal padding
    const ctaTextWidth = Math.max(220, cleanCta.length * 18 + 70);
    const ctaX = (1080 - ctaTextWidth) / 2;

    // Handle highlighted word in Hero title if provided
    let heroSvgContent = cleanHero;
    if (cleanHighlight && cleanHero.includes(cleanHighlight)) {
      const parts = cleanHero.split(cleanHighlight);
      heroSvgContent = `${parts[0]}<tspan fill="${cleanColor}">${cleanHighlight}</tspan>${parts.slice(1).join(cleanHighlight)}`;
    }

    // Build SVG overlay containing gradient scrim, text shadow filter, texts, and CTA button
    const svgOverlay = `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bottomScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0" />
      <stop offset="30%" stop-color="#000000" stop-opacity="0" />
      <stop offset="52%" stop-color="#000000" stop-opacity="0.62" />
      <stop offset="72%" stop-color="#000000" stop-opacity="0.90" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.98" />
    </linearGradient>
    <filter id="textGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
  </defs>

  <!-- Dark gradient scrim to guarantee maximum contrast against light/white backgrounds -->
  <rect width="1080" height="1080" fill="url(#bottomScrim)" />

  <!-- Hero Title -->
  <text x="540" y="${cleanSupport ? 840 : 870}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${cleanHero.length > 25 ? 46 : 56}" font-weight="900" fill="#FFFFFF" filter="url(#textGlow)">
    ${heroSvgContent}
  </text>

  <!-- Support Subtitle (if provided) -->
  ${cleanSupport ? `
  <text x="540" y="905" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${cleanSupport.length > 40 ? 28 : 32}" font-weight="500" fill="#E2E8F0" filter="url(#textGlow)">
    ${cleanSupport}
  </text>` : ""}

  <!-- CTA Pill Button -->
  <g filter="url(#textGlow)">
    <rect x="${ctaX}" y="955" width="${ctaTextWidth}" height="64" rx="32" ry="32" fill="${cleanColor}" />
    <text x="540" y="997" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" fill="#FFFFFF">
      ${cleanCta}
    </text>
  </g>
</svg>`;

    const svgDataUri = "data:image/svg+xml;base64," + Buffer.from(svgOverlay).toString("base64");

    // 1. Upload temporary SVG overlay as PNG to Cloudinary
    const overlayUpload = await cloudinary.uploader.upload(svgDataUri, {
      folder: "nutriologas/assets/temp",
      resource_type: "image",
      format: "png",
    });

    // 2. Composite base photo + SVG overlay layer
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: targetFolder,
      public_id: `banner_${Date.now()}`,
      resource_type: "image",
      transformation: [
        { width: 1080, height: 1080, crop: "fill", gravity: "auto" },
        { overlay: overlayUpload.public_id.replace(/\//g, ":"), width: 1080, height: 1080, crop: "fill" },
      ],
    });

    // 3. Cleanup temporary overlay layer in background (fire & forget)
    cloudinary.uploader.destroy(overlayUpload.public_id).catch(() => {});

    return NextResponse.json({
      success: true,
      imageUrl: result.secure_url,
      publicId: result.public_id,
      folder: result.folder,
      format: result.format,
      width: result.width,
      height: result.height,
    });
  } catch (error: any) {
    console.error("Error rendering post banner:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to render banner" },
      { status: 500 }
    );
  }
}
