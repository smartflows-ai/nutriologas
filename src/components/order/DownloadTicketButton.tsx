"use client";
// src/components/order/DownloadTicketButton.tsx

import { Download } from "lucide-react";

interface DownloadTicketButtonProps {
  className?: string;
}

export function DownloadTicketButton({ className = "" }: DownloadTicketButtonProps) {
  const baseStyles = "btn-primary flex items-center gap-2 text-sm";

  return (
    <button
      onClick={() => window.print()}
      className={`${baseStyles} ${className}`}
    >
      <Download size={16} />
      Descargar ticket
    </button>
  );
}
