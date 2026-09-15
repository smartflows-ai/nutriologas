"use client";
// src/components/chat/AssistantThinkingIndicator.tsx
// Animated, progress-driven thinking bubble for the AI Assistant.
// Rotates through dynamic business-aware status updates and motivational insights (like Claude / ChatGPT).

import { useState, useEffect } from "react";
import { Sparkles, Zap, Bot } from "lucide-react";
import { useTranslation } from "@/i18n";

interface AssistantThinkingIndicatorProps {
  tenantName?: string;
  businessInfo?: string;
  tenantSlug?: string;
}

type BusinessType = "health_clinic" | "store_ecommerce" | "general";

function detectBusinessType(
  businessInfo?: string,
  tenantName?: string,
  tenantSlug?: string,
): BusinessType {
  const text = `${businessInfo ?? ""} ${tenantName ?? ""} ${tenantSlug ?? ""}`.toLowerCase();

  if (
    text.includes("nutri") ||
    text.includes("medic") ||
    text.includes("clinic") ||
    text.includes("salud") ||
    text.includes("doctor") ||
    text.includes("paciente") ||
    text.includes("terapia") ||
    text.includes("dental") ||
    text.includes("bienestar") ||
    text.includes("diet")
  ) {
    return "health_clinic";
  }

  if (
    text.includes("tiend") ||
    text.includes("store") ||
    text.includes("shop") ||
    text.includes("product") ||
    text.includes("suplement") ||
    text.includes("ropa") ||
    text.includes("ecommerce") ||
    text.includes("comercio") ||
    text.includes("ventas")
  ) {
    return "store_ecommerce";
  }

  return "general";
}

export default function AssistantThinkingIndicator({
  tenantName,
  businessInfo,
  tenantSlug,
}: AssistantThinkingIndicatorProps) {
  const { lang } = useTranslation();
  const isEs = lang === "es";
  const [stepIndex, setStepIndex] = useState(0);

  const businessType = detectBusinessType(businessInfo, tenantName, tenantSlug);
  const displayName = tenantName?.trim() || (isEs ? "tu negocio" : "your business");

  // Dynamic progress sequence: (1) Intent & Parse, (2) Domain Query, (3) Strategic Reasoning, (4) Executive Synthesis
  const steps = isEs
    ? [
        {
          badge: "Interpretando consulta",
          message: "Analizando requerimientos y contexto de tu pregunta...",
          motivation: "Tu tiempo es valioso; optimizando cada respuesta para tu equipo.",
        },
        businessType === "health_clinic"
          ? {
              badge: "Base de Datos Clínica",
              message: `Consultando citas, pacientes y registros para ${displayName}...`,
              motivation: "Tu dedicación transforma la calidad de vida de tus pacientes.",
            }
          : businessType === "store_ecommerce"
          ? {
              badge: "Inventario y Ventas",
              message: `Analizando catálogo de productos y pedidos recientes de ${displayName}...`,
              motivation: "Cada pedido representa un paso hacia la escala de tu marca.",
            }
          : {
              badge: "Métricas Operativas",
              message: `Cruzando datos y rendimiento en tiempo real de ${displayName}...`,
              motivation: "Las mejores decisiones se toman con datos precisos y actualizados.",
            },
        {
          badge: "Estrategia IA",
          message: "Detectando tendencias clave y oportunidades de crecimiento...",
          motivation: "Convirtiendo números y eventos en acciones de alto impacto.",
        },
        {
          badge: "Sintetizando",
          message: "Estructurando la recomendación ejecutiva final...",
          motivation: "Tu visión de negocio potenciada con inteligencia artificial.",
        },
      ]
    : [
        {
          badge: "Parsing intent",
          message: "Analyzing inquiry context and parameters...",
          motivation: "Technology working continuously to save you valuable time.",
        },
        businessType === "health_clinic"
          ? {
              badge: "Clinical Records",
              message: `Reviewing appointments, patients, and schedule for ${displayName}...`,
              motivation: "Your dedication transforms the well-being of your community.",
            }
          : businessType === "store_ecommerce"
          ? {
              badge: "Inventory & Orders",
              message: `Auditing product catalog and sales trends for ${displayName}...`,
              motivation: "Every customer order scales your brand forward.",
            }
          : {
              badge: "Operations Engine",
              message: `Cross-referencing live metrics and trends for ${displayName}...`,
              motivation: "The greatest business moves start with clear, accurate data.",
            },
        {
          badge: "AI Intelligence",
          message: "Discovering growth patterns and high-value opportunities...",
          motivation: "Transforming raw data into strategic business momentum.",
        },
        {
          badge: "Synthesizing",
          message: "Formulating executive recommendation...",
          motivation: "Your business vision powered by advanced artificial intelligence.",
        },
      ];

  // Rotate messages every 2.4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2400);

    return () => clearInterval(timer);
  }, [steps.length]);

  const currentStep = steps[stepIndex] ?? steps[0];

  return (
    <div className="flex gap-3 items-start animate-fade-in">
      {/* Avatar with pulse */}
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <Sparkles size={16} className="text-primary animate-pulse" />
      </div>

      {/* Bubble */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm min-w-[280px] max-w-lg transition-all duration-300">
        {/* Header pill */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {currentStep.badge}
            </span>
          </div>

          {/* Stepper dots */}
          <div className="flex gap-1 items-center">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? "w-4 bg-primary"
                    : i < stepIndex
                    ? "w-1.5 bg-primary/40"
                    : "w-1.5 bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Dynamic Action Message */}
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug transition-all duration-200">
          {currentStep.message}
        </p>

        {/* Motivational Insight Footer */}
        <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <Zap size={12} className="text-amber-500 shrink-0 fill-amber-500/20" />
          <span className="italic truncate">{currentStep.motivation}</span>
        </div>
      </div>
    </div>
  );
}
