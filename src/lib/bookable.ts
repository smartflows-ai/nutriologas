// src/lib/bookable.ts
// One rule for "this item is sold by appointment": the tenant has booking on AND the item opts in.
// Items that are not bookable are information only (price and description), never booked by the bot or the web.
export function isBookable(product: { requiresBooking: boolean }, tenant: { isBookingEnabled: boolean }): boolean {
  return tenant.isBookingEnabled && product.requiresBooking;
}
