// tests/bot-visit-view.test.ts
// Ticket #111: how the app describes one visit to the WhatsApp bot (list, book and reschedule answers).
// Rules: Mexico time with the weekday (R1); an online visit carries its link and never the address,
// an in person visit carries the address and never a link (R2).
// Run with: npx tsx --test tests/bot-visit-view.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { botVisitTime, botVisitView, type BotVisitPlace, type BotVisitSource } from "../src/lib/bot-visit-view";

const ADDRESS = "Av. Siempre Viva 742, Monterrey. Cómo llegar: https://consultorio.newaigent.com/ubicacion";
const PLACE: BotVisitPlace = {
  shortLinkTenant: { slug: "consultorio", customDomain: null },
  locationText: ADDRESS,
  timeZone: "America/Mexico_City",
  timeZoneLabel: "hora de Ciudad de México",
};
const CANCUN: BotVisitPlace = { ...PLACE, timeZone: "America/Cancun", timeZoneLabel: "hora de Cancún" };
const TIJUANA: BotVisitPlace = { ...PLACE, timeZone: "America/Tijuana", timeZoneLabel: "hora de Tijuana" };
const REAL_MEET = "https://meet.google.com/abc-defg-hij";

function visit(overrides: Partial<BotVisitSource> = {}): BotVisitSource {
  return {
    appointmentDate: new Date("2026-11-18T01:30:00Z"), // Tuesday 17 Nov, 19:30 in Mexico
    modality: "IN_PERSON",
    meetUrl: null,
    meetShortCode: null,
    ...overrides,
  };
}

test("an evening visit is described on its Mexico day, never the UTC one", () => {
  const view = botVisitView(visit(), PLACE);
  assert.equal(view.date, "2026-11-17");
  assert.equal(view.weekday, "martes");
  assert.match(view.time, /^07:30\s?p\.\s?m\.$/);
  assert.equal(view.startsAt, "2026-11-17T19:30:00-06:00");
});

test("startsAt is the same instant as the stored visit", () => {
  const stored = new Date("2026-11-18T01:30:00Z");
  const view = botVisitView(visit({ appointmentDate: stored }), PLACE);
  assert.equal(new Date(view.startsAt).getTime(), stored.getTime());
  assert.doesNotMatch(view.startsAt, /Z$/);
});

test("23:59 and 00:00 in Mexico do not move to another day", () => {
  const lastMinute = botVisitView(visit({ appointmentDate: new Date("2026-11-18T05:59:00Z") }), PLACE);
  assert.equal(lastMinute.date, "2026-11-17");
  assert.equal(lastMinute.weekday, "martes");

  const midnight = botVisitView(visit({ appointmentDate: new Date("2026-11-18T06:00:00Z") }), PLACE);
  assert.equal(midnight.date, "2026-11-18");
  assert.equal(midnight.weekday, "miércoles");
  assert.equal(midnight.startsAt, "2026-11-18T00:00:00-06:00");
});

test("an online visit with a short code gets the short link and no address", () => {
  const view = botVisitView(visit({ modality: "ONLINE", meetUrl: REAL_MEET, meetShortCode: "Ab12Cd34" }), PLACE);
  assert.equal(view.modality, "ONLINE");
  assert.equal(view.meetLink, "https://consultorio.newaigent.com/online/Ab12Cd34");
  assert.equal(view.location, null);
});

test("an older online visit without a code gets the real link and no address", () => {
  const view = botVisitView(visit({ modality: "ONLINE", meetUrl: REAL_MEET, meetShortCode: null }), PLACE);
  assert.equal(view.meetLink, REAL_MEET);
  assert.equal(view.location, null);
});

test("an online visit with no link (business without Google) gets neither link nor address", () => {
  const view = botVisitView(visit({ modality: "ONLINE", meetUrl: null }), PLACE);
  assert.equal(view.meetLink, null);
  assert.equal(view.location, null);
});

test("an in person visit gets the address and never a link, even if a link was stored", () => {
  const view = botVisitView(visit({ modality: "IN_PERSON", meetUrl: REAL_MEET, meetShortCode: "Ab12Cd34" }), PLACE);
  assert.equal(view.modality, "IN_PERSON");
  assert.equal(view.location, ADDRESS);
  assert.equal(view.meetLink, null);
});

test("an older visit without modality counts as in person", () => {
  const view = botVisitView(visit({ modality: null, meetUrl: REAL_MEET }), PLACE);
  assert.equal(view.modality, null);
  assert.equal(view.location, ADDRESS);
  assert.equal(view.meetLink, null);
});

test("a business without a physical location gives no address", () => {
  const view = botVisitView(visit({ modality: "IN_PERSON" }), { ...PLACE, locationText: "" });
  assert.equal(view.location, null);
});

test("a custom domain is used for the short link", () => {
  const view = botVisitView(
    visit({ modality: "ONLINE", meetUrl: REAL_MEET, meetShortCode: "Ab12Cd34" }),
    { ...PLACE, shortLinkTenant: { slug: "consultorio", customDomain: "miconsultorio.mx" } },
  );
  assert.equal(view.meetLink, "https://miconsultorio.mx/online/Ab12Cd34");
});

test("botVisitTime gives only the time fields and the zone (used when a visit is cancelled)", () => {
  const time = botVisitTime(new Date("2026-11-18T01:30:00Z"), PLACE);
  assert.deepEqual(Object.keys(time).sort(), ["date", "startsAt", "time", "timeZone", "timeZoneLabel", "weekday"]);
  assert.equal(time.startsAt, "2026-11-17T19:30:00-06:00");
  assert.equal(time.date, "2026-11-17");
  assert.equal(time.weekday, "martes");
  assert.match(time.time, /^07:30\s?p\.\s?m\.$/);
});

test("every view names the business zone for the patient", () => {
  const view = botVisitView(visit(), PLACE);
  assert.equal(view.timeZone, "America/Mexico_City");
  assert.equal(view.timeZoneLabel, "hora de Ciudad de México");
});

test("a business in Cancun reads the same instant one hour later, with its own offset and name", () => {
  const view = botVisitView(visit({ appointmentDate: new Date("2026-11-18T01:30:00Z") }), CANCUN);
  assert.equal(view.date, "2026-11-17");
  assert.equal(view.weekday, "martes");
  assert.match(view.time, /^08:30\s?p\.\s?m\.$/);
  assert.equal(view.startsAt, "2026-11-17T20:30:00-05:00");
  assert.equal(view.timeZoneLabel, "hora de Cancún");
});

test("in Tijuana a late visit belongs to the same local day and uses that season's offset", () => {
  const winter = botVisitView(visit({ appointmentDate: new Date("2026-11-18T05:00:00Z") }), TIJUANA);
  assert.equal(winter.startsAt, "2026-11-17T21:00:00-08:00");
  assert.equal(winter.weekday, "martes");
  const summer = botVisitView(visit({ appointmentDate: new Date("2026-07-15T04:00:00Z") }), TIJUANA);
  assert.equal(summer.startsAt, "2026-07-14T21:00:00-07:00");
  assert.equal(summer.date, "2026-07-14");
});
