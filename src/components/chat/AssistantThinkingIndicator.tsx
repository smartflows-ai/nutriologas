"use client";
// src/components/chat/AssistantThinkingIndicator.tsx
// Animated, progress-driven thinking bubble for the AI Assistant.
// Rotates through business-aware status updates and motivational insights (like Claude / ChatGPT).

import { useState, useEffect } from "react";
import { Sparkles, Zap } from "lucide-react";
import { useTranslation } from "@/i18n";
import { fill } from "@/lib/utils";

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
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);

  const businessType = detectBusinessType(businessInfo, tenantName, tenantSlug);
  const displayName = tenantName?.trim() || t.assistantThinking.fallbackName;

  // Progress sequence: (1) intent, (2) domain query, (3) strategic reasoning, (4) executive synthesis
  const domainStep =
    businessType === "health_clinic"
      ? { badge: t.assistantThinking.clinicBadge, message: fill(t.assistantThinking.clinicMessage, { name: displayName }), motivation: t.assistantThinking.clinicMotivation }
      : businessType === "store_ecommerce"
      ? { badge: t.assistantThinking.storeBadge, message: fill(t.assistantThinking.storeMessage, { name: displayName }), motivation: t.assistantThinking.storeMotivation }
      : { badge: t.assistantThinking.opsBadge, message: fill(t.assistantThinking.opsMessage, { name: displayName }), motivation: t.assistantThinking.opsMotivation };

  const steps = [
    { badge: t.assistantThinking.intentBadge, message: t.assistantThinking.intentMessage, motivation: t.assistantThinking.intentMotivation },
    domainStep,
    { badge: t.assistantThinking.strategyBadge, message: t.assistantThinking.strategyMessage, motivation: t.assistantThinking.strategyMotivation },
    { badge: t.assistantThinking.synthBadge, message: t.assistantThinking.synthMessage, motivation: t.assistantThinking.synthMotivation },
  ];

  // Advance one step every 2.4 seconds
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
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <Sparkles size={16} className="text-primary animate-pulse" />
      </div>

      {/* Bubble */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm min-w-[280px] max-w-lg transition-all duration-300">
        {/* Header pill */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[11px] font-semibold text-primary">
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
                    ? "w-1.5 bg-gray-100 dark:bg-gray-800"
                    : "w-1.5 bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Dynamic action message */}
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug transition-all duration-200">
          {currentStep.message}
        </p>

        {/* Motivational insight footer */}
        <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <Zap size={12} className="text-amber-500 shrink-0 fill-amber-500/20" />
          <span className="italic truncate">{currentStep.motivation}</span>
        </div>
      </div>
    </div>
  );
}
