// src/app/api/internal/render-post-banner/route.ts
// Internal API endpoint for n8n to render marketing post banners with:
// - Background photo (from user catalog or editorial niche fallback)
// - Dark gradient bottom overlay
// - Branded hero title
// - Support value proposition
// - Rounded CTA pill button in accent color
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
      support,
      cta,
      accentColor = "#FF5722",
    } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    // Clean and sanitize texts for Cloudinary text overlay
    const cleanText = (str?: string, maxLen = 60) => {
      if (!str || typeof str !== "string") return "";
      return str
        .replace(/["'%,]/g, "") // remove characters that interfere with Cloudinary URL overlay parsing
        .trim()
        .slice(0, maxLen);
    };

    const cleanHero = cleanText(hero, 45) || "Promoción Especial";
    const cleanSupport = cleanText(support, 65);
    const cleanCta = cleanText(cta, 25) || "Más información";
    const cleanColor = /^#[0-9A-Fa-f]{6}$/.test(accentColor) ? accentColor : "#FF5722";

    const targetFolder = tenantId
      ? `nutriologas/${tenantId}/campaigns`
      : "nutriologas/campaigns";

    const transformations: any[] = [
      { width: 1080, height: 1080, crop: "fill", gravity: "auto" },
      { effect: "gradient_fade:40", gravity: "south", height: 0.5, color: "black" },
    ];

    // Hero Text
    transformations.push({
      overlay: {
        font_family: "Arial",
        font_size: cleanHero.length > 25 ? 44 : 52,
        font_weight: "bold",
        text: cleanHero,
      },
      color: "#FFFFFF",
      gravity: "south",
      y: cleanSupport ? 165 : 125,
    });

    // Support Text (if present)
    if (cleanSupport) {
      transformations.push({
        overlay: {
          font_family: "Arial",
          font_size: cleanSupport.length > 40 ? 26 : 30,
          text: cleanSupport,
        },
        color: "#E5E7EB",
        gravity: "south",
        y: 110,
      });
    }

    // CTA Pill Button
    transformations.push({
      overlay: {
        font_family: "Arial",
        font_size: 24,
        font_weight: "bold",
        text: cleanCta,
      },
      color: "#FFFFFF",
      background: cleanColor,
      radius: "max",
      gravity: "south",
      y: 40,
    });

    // Upload to Cloudinary with the composite transformations
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: targetFolder,
      public_id: `banner_${Date.now()}`,
      resource_type: "image",
      transformation: transformations,
    });

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
