"use client";
// src/app/admin/suscripcion/page.tsx
// Dedicated Amazon-style subscription checkout page for NewAigent tenant admin

import AmazonCheckout from "@/components/admin/AmazonCheckout";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function SuscripcionPage() {
  const { t } = useTranslation();
  return (
    <div className="py-2">
      <div className="mb-4">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white  transition-colors"
        >
          <ArrowLeft size={14} /> {t.billing.backToDashboard}
        </Link>
      </div>

      <AmazonCheckout
        onSuccess={() => {
          window.location.href = "/admin/dashboard?subscribed=true";
        }}
        onCancel={() => {
          window.location.href = "/admin/dashboard";
        }}
      />
    </div>
  );
}
