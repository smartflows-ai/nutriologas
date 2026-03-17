// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(date));
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
