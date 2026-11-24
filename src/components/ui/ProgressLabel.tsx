"use client";
// src/components/ui/ProgressLabel.tsx
// Shows a sequence of steps while an action runs (for example, a disconnect). The steps advance with elapsed
// time, not with the server's real state: the caller's action answers only when it is confirmed or refused.
// The last step stays until the action ends. Text comes from the caller (i18n), never from here.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/** The next step: one at a time, and never past the last one. */
export function nextStepIndex(current: number, total: number): number {
  return Math.min(current + 1, Math.max(total - 1, 0));
}

interface ProgressLabelProps {
  active: boolean;
  steps: string[];
  /** Time each step stays on screen. */
  intervalMs?: number;
}

export default function ProgressLabel({ active, steps, intervalMs = 6000 }: ProgressLabelProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const timer = setInterval(() => setIndex((i) => nextStepIndex(i, steps.length)), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, steps.length]);

  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite">
      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      {steps[index] ?? ""}
    </span>
  );
}
