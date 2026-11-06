const FALLBACK_RGB = "22 163 74";

// Converts "#16a34a" or "#1f2" into "22 163 74" so Tailwind can apply opacity modifiers (bg-primary/10).
export function hexToRgbChannels(hex: string | null | undefined): string {
  if (!hex) return FALLBACK_RGB;
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return FALLBACK_RGB;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#111827";
const LUMINANCE_THRESHOLD = 0.179;

/**
 * Text color that stays readable on the tenant's primary color: white or near-black, whichever contrasts more
 * (WCAG relative luminance of "r g b" channels). Anything unreadable falls back to white.
 */
export function readableTextOn(rgbChannels: string): string {
  const parts = rgbChannels.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return LIGHT_TEXT;
  const [r, g, b] = parts.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > LUMINANCE_THRESHOLD ? DARK_TEXT : LIGHT_TEXT;
}

export function themeColorVars(colors: { primaryColor?: string | null; secondaryColor?: string | null; accentColor?: string | null }) {
  return {
    "--color-primary": colors.primaryColor || "#16a34a",
    "--color-primary-rgb": hexToRgbChannels(colors.primaryColor),
    // Text and icons placed on a primary fill (bg-primary): use text-[color:var(--on-primary)], never text-white.
    "--on-primary": readableTextOn(hexToRgbChannels(colors.primaryColor)),
    "--color-secondary": colors.secondaryColor || "#15803d",
    "--color-secondary-rgb": hexToRgbChannels(colors.secondaryColor || "#15803d"),
    "--color-accent": colors.accentColor || "#4ade80",
    "--color-accent-rgb": hexToRgbChannels(colors.accentColor || "#4ade80"),
  };
}
