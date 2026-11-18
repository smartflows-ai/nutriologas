// src/components/admin/whatsapp/helpTone.ts
// The colors of the help states. Status colors, not brand colors: they keep the same meaning on any tenant theme.
// Color is never the only signal: every use also shows an icon and the reason as text.
import type { HelpTone } from "@/lib/help-view";

export const HELP_BAR_CLASS: Record<HelpTone, string> = {
  none: "",
  medium: "bg-amber-500",
  high: "bg-red-600",
};

export const HELP_TEXT_CLASS: Record<HelpTone, string> = {
  none: "text-gray-500",
  medium: "text-amber-700 dark:text-amber-400",
  high: "text-red-700 dark:text-red-400",
};

// Filled counter: white text on red is readable (about 5.9:1); white on amber is not (about 2:1), so amber takes a
// near-black amber text (not gray), which reads well on amber.
export const HELP_COUNT_CLASS: Record<HelpTone, string> = {
  none: "",
  medium: "bg-amber-500 text-amber-950",
  high: "bg-red-600 text-white",
};
