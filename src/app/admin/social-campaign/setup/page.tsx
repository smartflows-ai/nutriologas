"use client";
// DEV-ONLY page to manually set a Facebook Page Access Token.
// Access at /admin/social-campaign/setup — remove before production.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SocialCampaignSetupPage() {
  const router = useRouter();
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/apps/facebook/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageAccessToken, pageId, pageName }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("ok");
        setMsg(`Token guardado para la página "${data.pageName}" (${data.pageId})`);
        setTimeout(() => router.push("/admin/social-campaign"), 2000);
      } else {
        setStatus("error");
        setMsg(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus("error");
      setMsg("Error de conexión");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="card w-full max-w-lg p-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-yellow-500 text-black text-xs font-semibold px-2 py-0.5 rounded">DEV ONLY</span>
          <h1 className="text-gray-900 dark:text-white text-xl font-semibold">Setup Manual — Social Campaign</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Pega el Page Access Token obtenido desde el{" "}
          <a href="https://developers.facebook.com/tools/explorer" target="_blank" className="text-primary underline">
            Graph API Explorer
          </a>
          . Usa <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/me/accounts</code> para obtener el token de página.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-700 dark:text-gray-200 text-sm font-medium block mb-1">Page Access Token *</label>
            <textarea
              className="input w-full text-xs resize-none"
              rows={4}
              placeholder="EAAxxxxx..."
              value={pageAccessToken}
              onChange={(e) => setPageAccessToken(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-gray-700 dark:text-gray-200 text-sm font-medium block mb-1">Page ID *</label>
            <input
              type="text"
              className="input w-full"
              placeholder="122096156570879629"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-gray-700 dark:text-gray-200 text-sm font-medium block mb-1">Page Name</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Smart Flows"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="btn-primary w-full py-2.5 disabled:opacity-50"
          >
            {status === "loading" ? "Guardando..." : "Guardar Token"}
          </button>
        </form>

        {msg && (
          <p className={`mt-4 text-sm ${status === "ok" ? "text-primary" : "text-red-600 dark:text-red-400"}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
