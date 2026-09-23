"use client";
// src/app/admin/suscripcion/page.tsx
// Dedicated Amazon-style subscription checkout page for NewAigent tenant admin

import AmazonCheckout from "@/components/admin/AmazonCheckout";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SuscripcionPage() {
  return (
    <div className="py-2">
      <div className="mb-4">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={14} /> Regresar al Dashboard
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
