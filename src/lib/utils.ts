// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AppLocale = "es-MX" | "en-US";

// Maps the UI language to the Intl locale used for numbers and dates.
export function localeFor(lang: string): AppLocale {
  return lang === "en" ? "en-US" : "es-MX";
}

// Fills {placeholders} in a translated string: fill(t.booking.successTitle, { name })
export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

export function formatPrice(amount: number, locale: string = "es-MX", currency = "MXN") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date | string, locale: string = "es-MX") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(date));
}

export function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function getPeriodDates(period: "day" | "week" | "month" | "year") {
  const now = new Date();
  const startDate = new Date(now);
  switch (period) {
    case "day":   startDate.setHours(0, 0, 0, 0); break;
    case "week":  startDate.setDate(now.getDate() - 7); break;
    case "month": startDate.setMonth(now.getMonth() - 1); break;
    case "year":  startDate.setFullYear(now.getFullYear() - 1); break;
  }
  return { startDate, endDate: now };
}
