"use client";

import { useTranslation } from "@/i18n";
// src/components/order/PrintButton.tsx

import { Printer } from "lucide-react";

interface PrintButtonProps {
  variant?: "default" | "primary";
  className?: string;
}

export function PrintButton({ variant = "default", className = "" }: PrintButtonProps) {
  const { t } = useTranslation();
  const baseStyles = "flex items-center gap-2 text-sm";
  const variantStyles =
    variant === "primary"
      ? "btn-primary"
      : "btn-outline";

  return (
    <button
      onClick={() => window.print()}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      <Printer size={16} />
      {t.storefrontUi.printPdf}
    </button>
  );
}
