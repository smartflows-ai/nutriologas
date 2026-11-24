"use client";
// src/app/admin/apps/WhatsAppConnectModal.tsx
// Connects the business WhatsApp line: a QR the owner scans with the phone. Text comes from i18n (t.crm.apps.whatsappModal).
import { useEffect, useRef, useState } from "react";
import { X, Loader2, CheckCircle2, Smartphone, Link2, ScanLine } from "lucide-react";
import { useTranslation } from "@/i18n";
import { toast } from "@/hooks/useToast";

export default function WhatsAppConnectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"idle" | "loading" | "qr" | "expired" | "connected">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Escape closes the dialog, like the close button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const LOADING_MESSAGES = [
    t.integrationsUi.waLoading1,
    t.integrationsUi.waLoading2,
    t.integrationsUi.waLoading3,
    t.integrationsUi.waLoading4,
    t.integrationsUi.waLoading5
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

  // Connected: show the number the status answer carries (the server reads it again when Evolution is slow), then
  // close and go to the WhatsApp screen. The guard keeps the success to one run when two checks answer at once.
  const connectedRef = useRef(false);
  const showConnected = (number: string | null) => {
    if (connectedRef.current) return;
    connectedRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    setPhone(number);
    setStep("connected");
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
  };

  const startConnect = async () => {
    setStep("loading");
    setLoadingMsgIdx(0);
    const res = await fetch("/api/apps/connect/whatsapp", { method: "POST" });

    let data;
    try {
      data = await res.json();
    } catch (err) {
      toast(t.integrationsUi.waErrorNotJson);
      setStep("idle");
      return;
    }

    // Si la respuesta es error JSON
    if (!res.ok) {
      toast(data.error || t.integrationsUi.waErrorServer);
      setStep("idle");
      return;
    }

    // Si ya esta conectado, saltamos al exito
    if (data.status === "connected") {
      setStep("connected");
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
      return;
    }

    if (data.qrCode) {
      setQrCode(data.qrCode);
      setStep("qr");
      // Polling cada 2 segundos para detectar inmediatamente cuando el usuario escanea en el celular
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch("/api/apps/whatsapp/status", { cache: "no-store" }).then(r => r.json());
          if (s.status === "connected") {
            showConnected(s.phoneNumber ?? null);
          } else if (s.status === "qr_expired") {
            if (pollRef.current) clearInterval(pollRef.current);
            setStep("expired");
          } else if (s.qrCode && s.qrCode !== qrCode) {
            setQrCode(s.qrCode);
          }
        } catch (e) {
          console.warn("[whatsapp-poll] Error polling status:", e);
        }
      }, 2000);
    } else {
      toast(data.error || t.integrationsUi.waFailed);
      setStep("idle");
    }
  };

  useEffect(() => {
    // Verificación inmediata al abrir el modal: si ya está conectado, cerrar de inmediato
    fetch("/api/apps/whatsapp/status", { cache: "no-store" })
      .then(r => r.json())
      .then(s => {
        if (s.status === "connected") {
          showConnected(s.phoneNumber ?? null);
        }
      })
      .catch(() => {});

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="wa-connect-title" className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-sm p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 id="wa-connect-title" className="font-semibold text-gray-900 dark:text-white">{t.crm.apps.whatsappModal.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-400"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {step === "idle" && (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-6">
              {t.crm.apps.whatsappModal.desc}
            </p>
            <button
              onClick={startConnect}
              className="w-full py-3 text-[color:var(--on-primary)] text-sm font-semibold rounded-xl bg-primary hover:opacity-90 transition shadow-sm"
            >
              {t.crm.apps.whatsappModal.generateBtn}
            </button>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8 px-2 text-center h-40 justify-center">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm text-gray-600 dark:text-gray-400 italic animate-pulse transition-opacity duration-500">
              {LOADING_MESSAGES[loadingMsgIdx]}
            </p>
          </div>
        )}

        {step === "qr" && qrCode && (
          <div className="flex flex-col items-center text-center">
            <ol className="w-full mb-5 space-y-2.5 text-left">
              {[
                { Icon: Smartphone, text: t.crm.apps.whatsappModal.steps.open },
                { Icon: Link2, text: t.crm.apps.whatsappModal.steps.linked },
                { Icon: ScanLine, text: t.crm.apps.whatsappModal.steps.scan },
              ].map(({ Icon, text }, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0">
                    <Icon size={16} strokeWidth={2} className="text-gray-700 dark:text-gray-200" aria-hidden="true" />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-3 bg-white">
              {/* Evolution API returns base64 directly */}
              <img src={qrCode.startsWith("data:image") ? qrCode : `data:image/png;base64,${qrCode}`} alt={t.integrationsUi.waQrAlt} className="w-56 h-56" />
            </div>
            <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              {t.crm.apps.whatsappModal.waiting}
            </p>
          </div>
        )}

        {step === "expired" && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-4">{t.integrationsUi.waQrExpired}</p>
            <button onClick={startConnect} className="btn-primary">{t.integrationsUi.waQrRegenerate}</button>
          </div>
        )}

        {step === "connected" && (
          <div className="text-center py-6">
            <CheckCircle2 size={48} className="text-primary mx-auto mb-3" aria-hidden="true" />
            <p className="font-semibold text-gray-900 dark:text-white">{t.crm.apps.whatsappModal.success}</p>
            {phone && <p className="text-sm text-gray-500 mt-1">{phone}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
