"use client";
// src/app/admin/apps/page.tsx
// Central hub for managing connected integrations (tenant-level).
import { useEffect, useState } from "react";
import {
  Plug, Check, X, ExternalLink, Loader2, Calendar as CalendarIcon, CheckCircle2
} from "lucide-react";
import { useRef } from "react";

// ── Feature definitions ─────────────────────────────────────────
interface FeatureDef {
  id: string;
  name: string;
  description: string;
  icon: string | React.ReactNode;
  color: string;     // tailwind gradient classes
  comingSoon?: boolean;
  providers: {
    id: string; // e.g., 'GOOGLE', 'MICROSOFT'
    name: string;
    connectUrl: string;
    isCustomAction?: boolean;
  }[];
}

const FEATURES: FeatureDef[] = [
  {
    id: "calendar",
    name: "Calendario",
    description: "Sincronización de citas, lectura de eventos y agenda.",
    icon: "📅",
    color: "from-blue-500 to-indigo-600",
    providers: [
      { id: "GOOGLE", name: "Google", connectUrl: "/api/apps/oauth/google/start" },
      { id: "MICROSOFT", name: "Outlook", connectUrl: "/api/apps/oauth/microsoft/start" },
    ]
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Mensajería con clientes vía Evolution API.",
    icon: "💬",
    color: "from-green-500 to-green-600",
    comingSoon: false,
    providers: [
      { id: "WHATSAPP", name: "WhatsApp", connectUrl: "#", isCustomAction: true }
    ]
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Páginas, Messenger y anuncios.",
    icon: "📘",
    color: "from-blue-600 to-blue-700",
    comingSoon: true,
    providers: []
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Publicaciones, DMs y métricas.",
    icon: "📸",
    color: "from-pink-500 to-purple-600",
    comingSoon: true,
    providers: []
  },
];

// ── Connected app state from API ─────────────────────────────────
interface ConnectedAppInfo {
  provider: string;
  scopes: string | null;
  connectedAt: string;
}

function WhatsAppConnectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"idle" | "loading" | "qr" | "connected">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const LOADING_MESSAGES = [
    "Creando tu conexión segura con WhatsApp...",
    "Preparando tu número para uso exclusivo...",
    "Generando tu código QR único...",
    "Configurando el enlace con el Asistente IA...",
    "Afinando los últimos detalles..."
  ];
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  useEffect(() => {
    if (step === "loading") {
      const interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [step]);

  const startConnect = async () => {
    setStep("loading");
    setLoadingMsgIdx(0);
    const res = await fetch("/api/apps/connect/whatsapp", { method: "POST" });
    const data = await res.json();
    if (data.qrCode) {
      setQrCode(data.qrCode);
      setStep("qr");
      // Polling cada 3 segundos para detectar cuando escanea el QR
      pollRef.current = setInterval(async () => {
        const s = await fetch("/api/apps/whatsapp/status").then(r => r.json());
        if (s.status === "connected") {
          clearInterval(pollRef.current!);
          setPhone(s.phoneNumber);
          setStep("connected");
          setTimeout(() => { onSuccess(); onClose(); }, 2000);
        } else if (s.qrCode && s.qrCode !== qrCode) {
          setQrCode(s.qrCode); // refrescar QR si caducó
        }
      }, 3000);
    } else {
      // Handle error scenario gracefully
      alert(data.error || "Algo salió mal al conectar con Evolution API");
      setStep("idle");
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 dark:text-white">Conectar WhatsApp</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-400">
            <X size={20} />
          </button>
        </div>

        {step === "idle" && (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-6">
              Se creará una instancia de WhatsApp para tu clínica. Necesitarás escanear un código QR con tu teléfono.
            </p>
            <button
              onClick={startConnect}
              className="w-full py-3 text-white text-sm font-semibold rounded-xl bg-green-500 hover:bg-green-600 transition"
            >
              Generar código QR
            </button>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8 px-2 text-center h-40 justify-center">
            <Loader2 size={32} className="animate-spin text-green-500" />
            <p className="text-sm text-gray-600 dark:text-gray-400 italic animate-pulse transition-opacity duration-500">
              {LOADING_MESSAGES[loadingMsgIdx]}
            </p>
          </div>
        )}

        {step === "qr" && qrCode && (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo → escanea este QR
            </p>
            <div className="border-2 border-gray-100 rounded-xl p-3 inline-block mb-4 bg-white dark:bg-gray-900">
              {/* Evolution API returns base64 directly */}
              <img src={qrCode.startsWith("data:image") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR WhatsApp" className="w-48 h-48" />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
              <Loader2 size={12} className="animate-spin" />
              Esperando que escanees el QR...
            </div>
          </div>
        )}

        {step === "connected" && (
          <div className="text-center py-6">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 dark:text-white">¡WhatsApp conectado!</p>
            {phone && <p className="text-sm text-gray-500 mt-1">{phone}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppsPage() {
  const [apps, setApps] = useState<ConnectedAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/apps");
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps ?? []);
      }
    } catch (e) {
      console.error("Error loading apps:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApps(); }, []);

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`¿Desconectar ${provider}? Se perderá el acceso hasta reconectar.`)) return;
    setDisconnecting(provider);
    try {
      await fetch(`/api/apps/${provider.toLowerCase()}`, { method: "DELETE" });
      setApps((prev) => prev.filter((a) => a.provider !== provider));
    } finally {
      setDisconnecting(null);
    }
  };

  // Helper to find a matching active connection for a given feature
  const getActiveConnectionForFeature = (feat: FeatureDef) => {
    const providerIds = feat.providers.map(p => p.id);
    return apps.find(a => providerIds.includes(a.provider));
  };

  const getProviderName = (providerId: string) => {
    if (providerId === 'GOOGLE') return 'Google Calendar';
    if (providerId === 'MICROSOFT') return 'Outlook';
    if (providerId === 'WHATSAPP') return 'WhatsApp';
    return providerId;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Plug className="text-primary" size={24} />
          Apps e integraciónes
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Conecta servicios externos una sola vez. El calendario y el asistente IA los usarán automáticamente.
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 p-4">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          <strong className="text-primary">Nivel clínica</strong> — las conexiones aplican para toda la clínica. Solo los administradores pueden conectar o desconectar apps.
        </p>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feat) => {
            const activeConn = getActiveConnectionForFeature(feat);
            const isConnected = !!activeConn;
            const isDisconnecting = activeConn ? disconnecting === activeConn.provider : false;

            return (
              <div
                key={feat.id}
                className={`flex flex-col relative rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden transition-all hover:shadow-md ${
                  isConnected ? "border-primary/30" : feat.comingSoon ? "border-gray-100 opacity-60" : "border-gray-200"
                }`}
              >
                {/* Gradient top bar */}
                <div className={`h-1.5 bg-gradient-to-r ${feat.color}`} />

                <div className="p-5 flex flex-col flex-1">
                  {/* Icon + Name */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{feat.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{feat.name}</h3>
                        {feat.comingSoon && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            Próximamente
                          </span>
                        )}
                      </div>
                    </div>

                    {isConnected && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap">
                        <Check size={12} /> Conectado
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed flex-1">{feat.description}</p>

                  {/* Connected info */}
                  {isConnected && activeConn && (
                    <div className="mb-4 p-2.5 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100">
                      <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5 mb-1">
                        <Plug size={12} className="text-primary" />
                        Usando {getProviderName(activeConn.provider)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Vinculado el {new Date(activeConn.connectedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto">
                    {feat.comingSoon ? (
                      <button disabled className="w-full px-3 py-2 bg-gray-100 text-gray-400 text-xs font-medium rounded-lg cursor-not-allowed">
                        No disponible aún
                      </button>
                    ) : isConnected && activeConn ? (
                      <button
                        onClick={() => handleDisconnect(activeConn.provider)}
                        disabled={isDisconnecting}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {isDisconnecting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                        Desconectar {getProviderName(activeConn.provider)}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider text-center mb-1">
                          Elige una opción
                        </p>
                        <div className="flex flex-col gap-2">
                          {feat.providers.map(p => (
                            p.isCustomAction ? (
                              <button
                                key={p.id}
                                onClick={() => setWhatsappModalOpen(true)}
                                className="w-full flex items-center justify-center gap-1.5 px-2 py-2 bg-white dark:bg-gray-900 border border-gray-200 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors shadow-sm"
                              >
                                Conectar {p.name}
                              </button>
                            ) : (
                              <a
                                key={p.id}
                                href={p.connectUrl}
                                className="w-full flex items-center justify-center gap-1.5 px-2 py-2 bg-white dark:bg-gray-900 border border-gray-200 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors shadow-sm"
                              >
                                Conectar {p.name}
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {whatsappModalOpen && (
        <WhatsAppConnectModal
          onClose={() => setWhatsappModalOpen(false)}
          onSuccess={fetchApps}
        />
      )}
    </div>
  );
}
