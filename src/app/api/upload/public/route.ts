// src/app/api/upload/public/route.ts
// Unauthenticated endpoint for onboarding logo uploads only.
import crypto from "crypto";
import { apiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const cloudName = requireEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
    const apiKey    = requireEnv("CLOUDINARY_API_KEY");
    const apiSecret = requireEnv("CLOUDINARY_API_SECRET");

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File))
      return apiError("upload_file_required", 400);
    if (!ALLOWED_TYPES.has(file.type))
      return apiError("upload_invalid_type", 400);
    if (file.size > MAX_BYTES)
      return apiError("upload_too_large", 400);

    const folder    = "nutriologas/signups";
    const timestamp = Math.floor(Date.now() / 1000);
    const sig       = crypto
      .createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const uploadForm = new FormData();
    uploadForm.set("file", file);
    uploadForm.set("api_key", apiKey);
    uploadForm.set("timestamp", String(timestamp));
    uploadForm.set("folder", folder);
    uploadForm.set("signature", sig);

    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadForm,
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[upload/public] Cloudinary error:", data?.error?.message);
      return apiError("internal_error", 500);
    }

    return Response.json({ url: data.secure_url as string });
  } catch (e: any) {
    console.error("[upload/public] Error:", e);
    return apiError("internal_error", 500);
  }
}
