// src/lib/price-text.ts
// The price as text and as fields for what is sent to machines (the WhatsApp agent, Newy AI, campaign posts), in
// the business language. Server-side counterpart of the screens' priceViewFor. Pure, no I/O.
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { formatPrice } from "@/lib/utils";
import { priceModeOf, priceTextForBot, type PriceCopy, type PriceMode, type PricedItem } from "@/lib/price-display";

export function priceCopyFor(language: string): PriceCopy {
  return language === "en" ? en.price : es.price;
}

/** "$500.00", "From $500.00. The final price is ...", or the on-request sentence (no number). */
export function priceTextFor(item: PricedItem, language: string): string {
  const locale = language === "en" ? "en-US" : "es-MX";
  return priceTextForBot(item, priceCopyFor(language), (amount) => formatPrice(amount, locale));
}

/**
 * Price fields for a payload: `price` is null when there is no price to say (on request), so a machine has no
 * number to quote; `priceText` is the sentence to use as it is.
 */
export function priceFieldsFor(
  item: PricedItem,
  language: string
): { price: number | null; priceMode: PriceMode; priceText: string } {
  const priceMode = priceModeOf(item);
  return { price: priceMode === "ON_REQUEST" ? null : item.price, priceMode, priceText: priceTextFor(item, language) };
}
