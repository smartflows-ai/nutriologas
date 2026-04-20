// src/app/api/upload/public/route.ts
// Unauthenticated endpoint for onboarding logo uploads only.
import crypto from "crypto";

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
      return Response.json({ error: "file required" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type))
      return Response.json({ error: "Invalid file type. Use JPEG, PNG, WebP or SVG." }, { status: 400 });
    if (file.size > MAX_BYTES)
      return Response.json({ error: "File exceeds 5 MB limit." }, { status: 400 });

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
    if (!res.ok)
      return Response.json({ error: data?.error?.message ?? "Upload failed" }, { status: 500 });

    return Response.json({ url: data.secure_url as string });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
