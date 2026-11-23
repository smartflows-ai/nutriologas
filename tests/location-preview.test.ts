// Link preview of <tenant>.newaigent.com/ubicacion (ticket #142): crawlers get og: tags, browsers keep the redirect.
// Run: npx tsx --test tests/location-preview.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildLocationPreviewHtml, isPreviewCrawler } from "../src/lib/location-preview";

test("known preview crawlers are detected", () => {
  for (const ua of [
    "WhatsApp/2.23.20.0 A",
    "WhatsApp/2.0",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Facebot",
    "Twitterbot/1.0",
    "TelegramBot (like TwitterBot)",
    "Slackbot-LinkExpanding 1.0",
    "LinkedInBot/1.0",
    "Mozilla/5.0 (compatible; Discordbot/2.0)",
  ]) {
    assert.equal(isPreviewCrawler(ua), true, ua);
  }
});

test("normal browsers and a missing user agent are not crawlers", () => {
  for (const ua of [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    "",
  ]) {
    assert.equal(isPreviewCrawler(ua), false, ua);
  }
  assert.equal(isPreviewCrawler(null), false);
  assert.equal(isPreviewCrawler(undefined), false);
});

const base = { name: "Clínica Sol", address: "Av. Juárez 100, Monterrey", logoUrl: "https://res.cloudinary.com/x/logo.png", language: "es" };

test("preview carries name, address and logo as og tags", () => {
  const html = buildLocationPreviewHtml(base);
  assert.match(html, /<meta property="og:title" content="Clínica Sol">/);
  assert.match(html, /<meta property="og:description" content="Av\. Juárez 100, Monterrey">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/res\.cloudinary\.com\/x\/logo\.png">/);
  assert.match(html, /<html lang="es">/);
});

test("preview omits og:image without a logo and uses English labels", () => {
  const html = buildLocationPreviewHtml({ ...base, logoUrl: null, language: "en" });
  assert.doesNotMatch(html, /og:image/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /Directions/);
});

test("business text is escaped and an unsafe logo address is dropped", () => {
  const html = buildLocationPreviewHtml({ ...base, name: 'A"><script>x</script>', address: "<b>1</b> & 2", logoUrl: "javascript:alert(1)" });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&amp; 2/);
  assert.doesNotMatch(html, /og:image/);
});

test("preview never includes a phone or provider name", () => {
  const html = buildLocationPreviewHtml(base);
  assert.doesNotMatch(html, /tel:|whatsapp\.com|n8n|evolution|claude|openai/i);
});
