// src/lib/service-ref.ts
// Ticket #140: which service the agent means. The model retypes a 36 character id by hand and sometimes changes the
// end of it (run 22764: right up to the 21st character, wrong after), and the patient then hears "no encuentro el
// servicio" for a service that exists. The app resolves it with tolerance and never guesses: only an exact id, a unique
// 8-character prefix, or a unique exact name. Pure rules, no I/O: the routes load the active services of the business
// (so another business's services are never searched or offered) and call these.

/** Services listed in a failed lookup: a store with a large catalog must not flood the agent. */
export const MAX_RESCUE_OPTIONS = 30;

/** Characters of the id that must match for the prefix rule; fewer would make a guess too likely to be wrong. */
export const MIN_PREFIX_LENGTH = 8;

export interface ServiceRefItem {
  id: string;
  name: string;
}

export type ServiceRefVia = "id" | "prefix" | "name";

export type ServiceRefResult<T extends ServiceRefItem> =
  | { ok: true; service: T; via: ServiceRefVia }
  | { ok: false; error: "service_not_found"; options: ServiceRefItem[] };

const ID_LIKE = /^[0-9a-f-]{8,}$/i;

function normalizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * `services` are the active services of the business. `canOffer` decides which ones go in the list of a failed lookup
 * (the routes pass the bookable ones). A name or prefix that fits two services is not guessed.
 */
export function resolveServiceRef<T extends ServiceRefItem>(
  services: readonly T[],
  input: { productId?: unknown; serviceName?: unknown },
  canOffer: (service: T) => boolean = () => true,
): ServiceRefResult<T> {
  const typedId = text(input.productId);
  const typedName = text(input.serviceName) || typedId;

  if (typedId) {
    const exact = services.find((service) => service.id === typedId);
    if (exact) return { ok: true, service: exact, via: "id" };

    if (ID_LIKE.test(typedId)) {
      const head = typedId.slice(0, MIN_PREFIX_LENGTH).toLowerCase();
      const matches = services.filter((service) => service.id.toLowerCase().startsWith(head));
      if (matches.length === 1) return { ok: true, service: matches[0], via: "prefix" };
      if (matches.length > 1) return notFound(services, canOffer);
    }
  }

  if (typedName) {
    const wanted = normalizeName(typedName);
    const matches = services.filter((service) => normalizeName(service.name) === wanted);
    if (matches.length === 1) return { ok: true, service: matches[0], via: "name" };
  }

  return notFound(services, canOffer);
}

function notFound<T extends ServiceRefItem>(services: readonly T[], canOffer: (service: T) => boolean): ServiceRefResult<T> {
  return {
    ok: false,
    error: "service_not_found",
    options: services.filter(canOffer).map((service) => ({ id: service.id, name: service.name })),
  };
}

/**
 * The answer when the service cannot be resolved. The message is for the agent: it picks from the list and retries
 * without telling the patient that the service does not exist. It names no provider and no one kind of business.
 */
export function serviceNotFoundBody(options: readonly ServiceRefItem[], limit: number = MAX_RESCUE_OPTIONS) {
  const truncated = options.length > limit;
  const base =
    "No uses ese id. Elige de la lista de services el servicio que pidio el cliente, copia su id completo y vuelve a llamar la herramienta una vez. No le digas al cliente que el servicio no existe, salvo que ninguno de la lista se parezca a lo que pidio.";
  return {
    success: false as const,
    error: "service_not_found" as const,
    services: options.slice(0, limit),
    truncated,
    message: truncated
      ? `${base} La lista trae solo los primeros ${limit} servicios: si el cliente pidio otro, pidele su nombre exacto y llama la herramienta con serviceName.`
      : base,
  };
}
