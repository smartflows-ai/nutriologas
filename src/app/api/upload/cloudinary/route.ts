import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    const tenantId = (session.user as any).tenantId as string | undefined;
    if (!tenantId) return Response.json({ error: "Tenant no encontrado en sesión" }, { status: 400 });

    const cloudName = requireEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
    const apiKey = requireEnv("CLOUDINARY_API_KEY");
    const apiSecret = requireEnv("CLOUDINARY_API_SECRET");

    const form = await req.formData();
    const file = form.get("file");
    const kind = (form.get("kind")?.toString() ?? "misc").toLowerCase();
    const allowedKinds = new Set(["carousel", "products", "misc"]);
    const safeKind = allowedKinds.has(kind) ? kind : "misc";
    const folder = `nutriologas/${tenantId}/${safeKind}`;

    if (!file || !(file instanceof File)) {
      return Response.json({ error: "Archivo requerido (file)" }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signatureBase = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");

    const uploadForm = new FormData();
    uploadForm.set("file", file);
    uploadForm.set("api_key", apiKey);
    uploadForm.set("timestamp", String(timestamp));
    uploadForm.set("folder", folder);
    uploadForm.set("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadForm,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return Response.json(
        { error: data?.error?.message ?? "Error subiendo a Cloudinary", details: data },
        { status: 500 }
      );
    }

    return Response.json({
      url: data.secure_url as string,
      publicId: data.public_id as string,
      width: data.width as number,
      height: data.height as number,
      format: data.format as string,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Error inesperado" }, { status: 500 });
  }
}
