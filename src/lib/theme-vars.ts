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

export function themeColorVars(colors: { primaryColor?: string | null; secondaryColor?: string | null; accentColor?: string | null }) {
  return {
    "--color-primary": colors.primaryColor || "#16a34a",
    "--color-primary-rgb": hexToRgbChannels(colors.primaryColor),
    "--color-secondary": colors.secondaryColor || "#15803d",
    "--color-secondary-rgb": hexToRgbChannels(colors.secondaryColor || "#15803d"),
    "--color-accent": colors.accentColor || "#4ade80",
    "--color-accent-rgb": hexToRgbChannels(colors.accentColor || "#4ade80"),
  };
}
