"use client";
// src/components/admin/TrialBanner.tsx
import { useState } from "react";
import { Zap, X } from "lucide-react";

interface Props {
  daysLeft: number;
}

export default function TrialBanner({ daysLeft }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isUrgent = daysLeft <= 3;

  const handleUpgrade = async () => {
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.origin }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Could not open billing portal. Please contact support@newaigent.com");
    }
  };

  return (
    <div
      className={`relative flex items-center justify-between px-4 py-2.5 text-sm font-medium ${isUrgent
          ? "bg-gradient-to-r from-orange-600/90 to-rose-600/90"
          : "bg-gradient-to-r from-violet-700/80 to-indigo-700/80"
        } backdrop-blur-sm`}
    >
      <div className="flex items-center gap-2 text-white">
        <Zap size={15} className="shrink-0" />
        <span>
          {daysLeft > 0
            ? `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`
            : "Your free trial has ended."}
          {" "}
        </span>
        <button
          onClick={handleUpgrade}
          className="underline underline-offset-2 font-bold hover:no-underline transition-all"
        >
          Upgrade now →
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="ml-4 text-white/60 hover:text-white transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
