// local-utils/gen-cost-analysis-us.js
// Generates docs/analisis-costos-y-precios-eeuu.md (United States, USD) from the parameters below.
// Prices are the Stripe estimates the owner shared. Change a parameter and run: node local-utils/gen-cost-analysis-us.js
const fs = require("fs");

// ---------------------------------------------------------------- Parameters
const HOURS_MONTH = 730;
const EC2_MEDIUM = 0.0416 * HOURS_MONTH;
const EBS_IP_MEDIUM = 8;
const DOMAINS = 2.5;
const VERCEL_PRO = 20;
const SUPABASE_PRO = 25;
const FIXED_F1 = EC2_MEDIUM + EBS_IP_MEDIUM + DOMAINS + VERCEL_PRO + SUPABASE_PRO;

// Plans in Stripe (USD). Quotas are assumptions: the US plans have no conversation limit defined yet.
const PLANS = [
  { name: "Starter", monthly: 29, annual: 228, conversations: 250, crmQueries: 50, mix: 0.7 },
  { name: "Pro", monthly: 79, annual: 708, conversations: 1200, crmQueries: 200, mix: 0.3 },
];

// Plus (monthly only, decision D6). Price not chosen yet: the candidates below are compared.
// Quotas are assumptions between Start (250) and Pro (1,200), as in Mexico's Plus (600 conversations).
const PLUS_CANDIDATES = [39, 49, 59];
const PLUS_ASSUMED = { name: "Plus", conversations: 600, crmQueries: 100 };

const REPLIES_PER_CONVERSATION = 8;
const BOOKING_RATE = 0.35;
const EXTRA_UTILITY_FACTOR = 1.2;
const WA_UTILITY_USD = 0.004; // Meta utility message, United States (third-party figure, to verify)
const ALLOWANCE_USD = 0.6; // Supabase, Cloudinary and Vercel margin per customer
const TYPICAL_USAGE = 0.6;

// LLM cost per call in USD. bot reply = 2000 in / 200 out; CRM query = 4000 in / 500 out
// Gemini 2.5 Flash 0.30 in / 2.50 out per M; GPT-4o 2.50 / 10 per M (same table as src/lib/credits.ts)
const LLM = {
  "Gemini 2.5 Flash (modelo actual)": { reply: 0.0011, crm: 0.00245 },
  "GPT-4o (premium)": { reply: 0.007, crm: 0.015 },
};
const LLM_NAMES = Object.keys(LLM);

// Stripe United States (third-party figure): 2.9 % + US$0.30 per charge. Sales tax is not included in the prices.
const stripeFee = (charge) => 0.029 * charge + 0.3;

const usd = (v, d = 2) => (v < 0 ? "-" : "") + "US$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v) => (v * 100).toFixed(0) + " %";

const replies = (p) => p.conversations * REPLIES_PER_CONVERSATION;
const waCost = (p, usage) => p.conversations * BOOKING_RATE * EXTRA_UTILITY_FACTOR * WA_UTILITY_USD * usage;
const llmCost = (p, model, usage) => (replies(p) * LLM[model].reply + p.crmQueries * LLM[model].crm) * usage;
// Monthly net revenue per business after the payment fee. Annual plans are charged once, so the fee is spread over 12 months.
const monthlyNet = (p) => p.monthly - stripeFee(p.monthly);
const annualNet = (p) => (p.annual - stripeFee(p.annual)) / 12;
const contribution = (p, model, usage, annual) => (annual ? annualNet(p) : monthlyNet(p)) - waCost(p, usage) - llmCost(p, model, usage) - ALLOWANCE_USD;
const weighted = (model, usage, annual) => PLANS.reduce((s, p) => s + p.mix * contribution(p, model, usage, annual), 0);

// ---------------------------------------------------------------- Document
const L = [];
const add = (s = "") => L.push(s);
const MAIN = LLM_NAMES[0];

add("# Análisis de costos y precios, Estados Unidos (USD)");
add("");
add("Estado: estimado para decidir. Generado con `local-utils/gen-cost-analysis-us.js`. Para México ver `analisis-costos-y-precios.md`.");
add("Fecha: 2026-10-29. Moneda: dólares (USD). Los precios son los **estimados** que hoy están en Stripe; todavía no son finales.");
add("");

add("## 1. Precios en Stripe (estimados)");
add("");
add("| Plan | Mensual | Anual | Equivale al mes | Descuento anual |");
add("|---|---|---|---|---|");
for (const p of PLANS) add("| " + p.name + " | " + usd(p.monthly, 0) + " | " + usd(p.annual, 0) + " | " + usd(p.annual / 12) + " | " + pct(1 - p.annual / (p.monthly * 12)) + " |");
add("");
add("Observaciones:");
add("");
add("- El producto **Pro Anual Dlls** tiene además un precio de US$1,600 **por mes**. Parece un error (20 veces el mensual de Pro). Hay que archivarlo en Stripe si no es intencional.");
add("- Plus se añade también en Estados Unidos (decisión D6): mensual solamente, precio por confirmar. Ver la sección 3b. Los nombres en Stripe hoy son Starter y Pro; falta crear el precio de Plus.");
add("- No hay cobro único de implementación definido para Estados Unidos; este análisis no lo incluye.");
add("- Las cuotas de conversaciones por plan no están definidas para Estados Unidos. Supuesto: Starter 250 y Pro 1,200, iguales a Start y Pro de México.");
add("");

add("## 2. Supuestos");
add("");
add("| Supuesto | Valor | Nota |");
add("|---|---|---|");
add("| Impuestos | Sin impuesto de ventas | Se asume que los precios no lo incluyen. El impuesto de ventas a software por suscripción depende del estado; consulta a un contador. |");
add("| Comisión de pago (Stripe Estados Unidos) | 2.9 % + US$0.30 por cobro | Cifra de terceros; verificar. El plan anual paga la comisión una sola vez. |");
add("| Mensaje de plantilla de Meta (Estados Unidos) | " + usd(WA_UTILITY_USD, 4) + " | Cifra de terceros; verificar en la tarifa de Meta. Hoy el envío es por Evolution API (sin cobro por mensaje). |");
add("| Respuestas del bot por conversación | " + REPLIES_PER_CONVERSATION + " | 2,000 tokens de entrada y 200 de salida cada una |");
add("| Consultas del CRM | Starter " + PLANS[0].crmQueries + ", Pro " + PLANS[1].crmQueries + " | 4,000 de entrada y 500 de salida cada una |");
add("| Conversaciones que terminan en cita | " + pct(BOOKING_RATE) + " | Define cuántos recordatorios se mandan |");
add("| Colchón por cliente | " + usd(ALLOWANCE_USD) + " | Supabase, Cloudinary y Vercel |");
add("| Mezcla de planes | 70 % Starter, 30 % Pro | Supuesto |");
add("| Costo fijo de producción mínima | " + usd(FIXED_F1) + " al mes | AWS t3.medium, disco e IP, dominios, Vercel Pro y Supabase Pro (igual que F1 de México) |");
add("");

add("## 3. Contribución por negocio al mes");
add("");
add("Contribución = ingreso menos comisión de pago, WhatsApp, modelo y colchón. Se muestra con toda la cuota y con uso típico (" + pct(TYPICAL_USAGE) + ").");
add("");
add("| Plan | Cobro | Uso | WhatsApp | " + LLM_NAMES.join(" | ") + " |");
add("|---|---|---|---|" + LLM_NAMES.map(() => "---").join("|") + "|");
for (const p of PLANS) {
  for (const annual of [false, true]) {
    for (const usage of [1, TYPICAL_USAGE]) {
      add("| " + p.name + " | " + (annual ? "anual" : "mensual") + " | " + pct(usage) + " | " + usd(waCost(p, usage)) + " | " + LLM_NAMES.map((m) => {
        const c = contribution(p, m, usage, annual);
        const rev = annual ? p.annual / 12 : p.monthly;
        return usd(c) + " (" + pct(c / rev) + ")";
      }).join(" | ") + " |");
    }
  }
}
add("");
add("### 3b. Plus, precios candidatos (mensual)");
add("");
add("Cuota supuesta: " + PLUS_ASSUMED.conversations + " conversaciones y " + PLUS_ASSUMED.crmQueries + " consultas del CRM al mes. Neto = precio menos comisión de pago.");
add("");
add("| Precio | Neto | Uso | WhatsApp | " + LLM_NAMES.join(" | ") + " |");
add("|---|---|---|---|" + LLM_NAMES.map(() => "---").join("|") + "|");
for (const price of PLUS_CANDIDATES) {
  const plus = { name: PLUS_ASSUMED.name, monthly: price, conversations: PLUS_ASSUMED.conversations, crmQueries: PLUS_ASSUMED.crmQueries };
  for (const usage of [1, TYPICAL_USAGE]) {
    add("| " + usd(price, 0) + " | " + usd(monthlyNet(plus)) + " | " + pct(usage) + " | " + usd(waCost(plus, usage)) + " | " + LLM_NAMES.map((m) => {
      const c = contribution(plus, m, usage, false);
      return usd(c) + " (" + pct(c / price) + ")";
    }).join(" | ") + " |");
  }
}
add("");
add("Lectura: con Gemini 2.5 Flash todos los planes dejan margen aun usando toda la cuota.");
add("");
add("Lectura: con Gemini 2.5 Flash todos los planes dejan margen aun usando toda la cuota. El plan anual de Starter (US$19 al mes) es el más delgado; con GPT-4o el margen se reduce mucho y el plan Pro anual pierde dinero si el cliente usa toda la cuota, así que ese modelo necesita tope.");
add("");

add("## 4. Punto de equilibrio");
add("");
add("Negocios necesarios para cubrir " + usd(FIXED_F1) + " al mes de infraestructura, con mezcla 70 / 30.");
add("");
add("| Cobro | Modelo | Uso | Contribución promedio | Negocios |");
add("|---|---|---|---|---|");
for (const annual of [false, true]) {
  for (const m of LLM_NAMES) {
    for (const usage of [1, TYPICAL_USAGE]) {
      const w = weighted(m, usage, annual);
      add("| " + (annual ? "anual" : "mensual") + " | " + m + " | " + pct(usage) + " | " + usd(w) + " | " + (w > 0 ? Math.ceil(FIXED_F1 / w) : "no alcanza") + " |");
    }
  }
}
add("");
add("El costo fijo se comparte con México: n8n, Evolution y la base de datos son los mismos. Los clientes de Estados Unidos ayudan a cubrir lo que ya pagas.");
add("");

add("## 5. Pendiente");
add("");
add("1. Elegir el precio mensual de Plus en Estados Unidos (ver 3b) y crearlo en Stripe; confirmar la cuota de conversaciones de Plus (supuesto 600).");
add("2. Definir el cobro único de implementación para Estados Unidos.");
add("3. Decidir si el descuento anual debe ser igual en los dos planes (hoy 34 % en Starter y 25 % en Pro).");
add("4. Archivar el precio de US$1,600 por mes en Pro Anual Dlls si es un error.");
add("5. Impuesto de ventas por estado y obligaciones fiscales de vender a Estados Unidos desde México: consultar a un contador.");
add("6. Verificar la tarifa de Meta y de Stripe en sus sitios; las cifras de este documento son de terceros.");
add("7. Los textos legales y el aviso de privacidad también deben revisarse para clientes en Estados Unidos (hoy están redactados para México).");
add("");

fs.writeFileSync("docs/analisis-costos-y-precios-eeuu.md", L.join("\n") + "\n");
console.log("written, lines:", L.length);
