"use client";
// src/components/marketing/DemoSection.tsx
import { useTranslation } from "@/i18n";
import { ShoppingBag, MessageSquare, Bot, BarChart2, Calendar, Building2 } from "lucide-react";

export default function DemoSection() {
  const { t } = useTranslation();

  const chapters = [
    { icon: <ShoppingBag size={16} className="text-violet-400" />, title: "Tienda Online 24/7" },
    { icon: <MessageSquare size={16} className="text-emerald-400" />, title: "WhatsApp CRM con IA" },
    { icon: <Bot size={16} className="text-blue-400" />, title: "Generador de Contenido Social" },
    { icon: <BarChart2 size={16} className="text-amber-400" />, title: "Métricas y Finanzas en Vivo" },
    { icon: <Calendar size={16} className="text-pink-400" />, title: "Agenda y Citas Médicas" },
    { icon: <Building2 size={16} className="text-indigo-400" />, title: "Multi-Tenant y Marca Blanca" },
  ];

  return (
    <section
      id="demo"
      className="relative py-20 lg:py-28 overflow-hidden"
      style={{ background: "#090914" }}
    >
      {/* Ambient background glows */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full opacity-20 blur-[130px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #7C3AED 0%, #06B6D4 50%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 mb-4">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">
              Demo Completo en Español
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Mira <span style={{
              background: "linear-gradient(135deg, #A78BFA 0%, #60A5FA 50%, #06B6D4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>NewAigent</span> en Acción
          </h2>

          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Descubre en menos de 2 minutos cómo la plataforma automatiza tus ventas por WhatsApp, tienda digital, publicaciones de redes y citas.
          </p>
        </div>

        {/* Video Player Card */}
        <div className="relative rounded-3xl p-2 sm:p-3 bg-gradient-to-b from-white/15 via-white/5 to-white/0 border border-white/10 shadow-[0_20px_70px_rgba(124,58,237,0.25)] backdrop-blur-2xl">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
            <video
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
              src="/demo-video.mp4"
            >
              <source src="/demo-video.mp4" type="video/mp4" />
              <source src="/demo%20video/NewAigent%20video%20espa%C3%B1ol.mp4" type="video/mp4" />
              Tu navegador no soporta la reproducción de video HTML5.
            </video>
          </div>
        </div>

        {/* Chapters / Feature Pills under video */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {chapters.map((ch) => (
            <div
              key={ch.title}
              className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm flex items-center gap-2.5 text-left shadow-sm"
            >
              <span className="flex-shrink-0 flex items-center justify-center">{ch.icon}</span>
              <span className="text-xs font-semibold text-gray-200 leading-tight">
                {ch.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
