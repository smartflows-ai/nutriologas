// src/lib/price-display.ts
// A price can be fixed, a starting price ("from") or defined after the assessment ("on request"). One module
// decides what every screen, the bot and the money paths do with it. Pure functions, no I/O: the callers pass
// the translated texts and the money formatter.
import { fill, formatPrice } from "@/lib/utils";

export type PriceMode = "FIXED" | "FROM" | "ON_REQUEST";
export type PriceKind = "fixed" | "from" | "onRequest" | "free";

export interface PricedItem {
  price: number;
  priceMode?: PriceMode | null;
}

/** Texts (from the translation files). `from` carries an {amount} placeholder. */
export interface PriceCopy {
  from: string;
  onRequest: string;
  free: string;
  footnote: string;
}

export interface PriceView {
  kind: PriceKind;
  /** The number to show, or null when there is none to show (on request). */
  amount: number | null;
  text: string;
  /** Sentence to show next to the price when it is not final; null for a fixed price. */
  footnote: string | null;
}

const MODES: readonly string[] = ["FIXED", "FROM", "ON_REQUEST"];

/** Items saved before the field existed, or with a value this code does not know, are fixed. */
export function priceModeOf(item: PricedItem): PriceMode {
  return item.priceMode && MODES.includes(item.priceMode) ? item.priceMode : "FIXED";
}

export function priceView(item: PricedItem, copy: PriceCopy, formatAmount: (amount: number) => string): PriceView {
  const mode = priceModeOf(item);
  if (mode === "FIXED") {
    return item.price > 0
      ? { kind: "fixed", amount: item.price, text: formatAmount(item.price), footnote: null }
      : { kind: "free", amount: 0, text: copy.free, footnote: null };
  }
  // A starting price needs a number; without one it is the same as "on request" (never show a zero).
  if (mode === "FROM" && item.price > 0) {
    return { kind: "from", amount: item.price, text: fill(copy.from, { amount: formatAmount(item.price) }), footnote: copy.footnote };
  }
  return { kind: "onRequest", amount: null, text: copy.onRequest, footnote: copy.footnote };
}

/** Only a fixed price above zero can be added to a cart and charged. */
export function isPurchasable(item: PricedItem): boolean {
  return priceModeOf(item) === "FIXED" && item.price > 0;
}

export function partitionPurchasable<T extends PricedItem>(items: readonly T[]): { purchasable: T[]; refused: T[] } {
  const purchasable: T[] = [];
  const refused: T[] = [];
  for (const item of items) (isPurchasable(item) ? purchasable : refused).push(item);
  return { purchasable, refused };
}

/** What the WhatsApp agent is given to say about the price: the label and, when it is not final, the footnote. */
export function priceTextForBot(item: PricedItem, copy: PriceCopy, formatAmount: (amount: number) => string): string {
  const view = priceView(item, copy, formatAmount);
  return view.footnote ? `${view.text}. ${view.footnote}` : view.text;
}

export interface AssessmentOwner {
  id: string;
  tenantId: string;
  priceMode?: PriceMode | null;
  assessmentProductId?: string | null;
}

export interface AssessmentCandidate {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  deletedAt: Date | null;
  requiresBooking: boolean;
  price: number;
  priceMode?: PriceMode | null;
}

/**
 * The service to book to learn the price of an "on request" service (the injury that points to the general
 * consultation). It only counts while it is still the one pointed to, in the same business, visible, bookable
 * and fixed-price; otherwise the redirect silently stops instead of sending the customer to a dead page.
 */
export function resolveAssessmentTarget(
  owner: AssessmentOwner,
  candidate: AssessmentCandidate | null,
  tenant: { isBookingEnabled: boolean }
): { id: string; name: string; slug: string } | null {
  if (!candidate || !owner.assessmentProductId) return null;
  if (priceModeOf({ price: 0, priceMode: owner.priceMode }) !== "ON_REQUEST") return null;
  if (candidate.id !== owner.assessmentProductId || candidate.id === owner.id) return null;
  if (candidate.tenantId !== owner.tenantId) return null;
  if (!candidate.isActive || candidate.deletedAt) return null;
  if (!tenant.isBookingEnabled || !candidate.requiresBooking) return null;
  if (priceModeOf(candidate) !== "FIXED") return null;
  return { id: candidate.id, name: candidate.name, slug: candidate.slug };
}

/** Sort by price with "on request" always last, in both directions. Returns a new list. */
export function sortByPrice<T extends PricedItem>(items: readonly T[], direction: "asc" | "desc"): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const aAsk = priceModeOf(a) === "ON_REQUEST";
    const bAsk = priceModeOf(b) === "ON_REQUEST";
    if (aAsk !== bAsk) return aAsk ? 1 : -1;
    return (a.price - b.price) * sign;
  });
}

export interface PriceInput {
  price?: number;
  priceMode?: PriceMode | null;
  itemType?: string;
  assessmentProductId?: string | null;
}

export type PriceInputResult =
  | { ok: true; value: { price?: number; priceMode?: PriceMode; assessmentProductId?: string | null; requiresBooking?: false } }
  | { ok: false; error: "priceRequired" | "pricePositive" | "startingPriceRequired" };

/**
 * What is saved for the price fields of a product, whatever the form sent. "On request" stores a price of 0 and
 * keeps the assessment pointer; the other modes drop the pointer. A starting price needs an amount above zero. A
 * free price (0) is only for services, packages and subscriptions: a free physical item could never be bought.
 * `partial` is an update that may leave the price fields out.
 */
export function normalizePriceInput(input: PriceInput, options: { partial: boolean }): PriceInputResult {
  const mode = input.priceMode ?? undefined;
  const price = input.price;
  if (mode === "ON_REQUEST") {
    // A service that points to another one to learn its price is not booked by itself.
    const pointer = input.assessmentProductId ?? null;
    return { ok: true, value: { price: 0, priceMode: "ON_REQUEST", assessmentProductId: pointer, ...(pointer ? { requiresBooking: false as const } : {}) } };
  }
  if (mode === undefined && price === undefined && options.partial) return { ok: true, value: {} };
  // No price typed is never read as free: a free item needs an explicit 0.
  if (price === undefined || !Number.isFinite(price)) return { ok: false, error: "priceRequired" };
  if (price < 0) return { ok: false, error: "pricePositive" };
  if (mode === "FROM") {
    if (price <= 0) return { ok: false, error: "startingPriceRequired" };
    return { ok: true, value: { price, priceMode: "FROM", assessmentProductId: null } };
  }
  const freeAllowed = input.itemType !== undefined && input.itemType !== "PHYSICAL";
  if (price === 0 && !freeAllowed) return { ok: false, error: "pricePositive" };
  return { ok: true, value: { price, ...(mode ? { priceMode: mode } : {}), assessmentProductId: null } };
}

/** priceView with the platform money format for a locale (what the screens use). */
export function priceViewFor(item: PricedItem, copy: PriceCopy, locale: string): PriceView {
  return priceView(item, copy, (amount) => formatPrice(amount, locale));
}

export type StoreAction =
  | { kind: "book" }
  | { kind: "bookTarget"; target: { id: string; name: string; slug: string } }
  | { kind: "cart" }
  | { kind: "ask" }
  | { kind: "none" };

/**
 * The one button a product page offers. A service that points to another one sends the customer there; a
 * bookable item is booked; a fixed-price item goes to the cart; a price that is not final (and a free item that
 * is not booked) is never added to the cart: the customer asks on WhatsApp, or there is nothing to press.
 */
export function storeAction(
  item: PricedItem,
  context: { bookable: boolean; target: { id: string; name: string; slug: string } | null }
): StoreAction {
  if (priceModeOf(item) === "ON_REQUEST" && context.target) return { kind: "bookTarget", target: context.target };
  if (context.bookable) return { kind: "book" };
  if (isPurchasable(item)) return { kind: "cart" };
  return priceModeOf(item) === "FIXED" ? { kind: "none" } : { kind: "ask" };
}

/** WhatsApp link with a prefilled message, from a stored number such as "+5215512345678". Null without digits. */
export function whatsappAskUrl(number: string | null | undefined, message: string): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}
