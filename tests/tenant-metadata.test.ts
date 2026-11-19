import { test } from "node:test";
import assert from "node:assert/strict";
import { previewImageUrl, tenantPreview } from "../src/lib/tenant-metadata";

const BASE = {
  name: "Consultorio Ana",
  slug: "ana",
  customDomain: null,
  businessInfo: null,
  logoUrl: null,
  messageLanguage: "es",
  fallbackImage: null,
};

test("the preview speaks the business language, never the reader's", () => {
  assert.equal(tenantPreview(BASE).lang, "es");
  assert.equal(tenantPreview(BASE).locale, "es_MX");
  assert.equal(tenantPreview(BASE).description, "Bienvenido a Consultorio Ana");
  const en = tenantPreview({ ...BASE, messageLanguage: "en" });
  assert.equal(en.lang, "en");
  assert.equal(en.locale, "en_US");
  assert.equal(en.description, "Welcome to Consultorio Ana");
  // An unknown stored value falls back to Spanish, the default of every business.
  assert.equal(tenantPreview({ ...BASE, messageLanguage: "fr" }).lang, "es");
});

test("the business description is used, on one line and cut at a word", () => {
  const short = tenantPreview({ ...BASE, businessInfo: "Ginecología y\n\nobstetricia   en Monterrey." });
  assert.equal(short.description, "Ginecología y obstetricia en Monterrey.");
  const long = tenantPreview({ ...BASE, businessInfo: `${"palabra ".repeat(60)}final` });
  assert.ok(long.description.length <= 161, String(long.description.length));
  assert.ok(long.description.endsWith("…"));
  assert.ok(!long.description.includes("palabr…"), "cut inside a word");
  assert.equal(tenantPreview({ ...BASE, businessInfo: "   " }).description, "Bienvenido a Consultorio Ana");
});

test("the url is the business's own address", () => {
  assert.equal(tenantPreview(BASE, "newaigent.com").url, "https://ana.newaigent.com");
  assert.equal(tenantPreview({ ...BASE, customDomain: "consultorioana.mx" }, "newaigent.com").url, "https://consultorioana.mx");
});

test("the image is the logo, else the first carousel or service photo, else none", () => {
  const logo = "https://res.cloudinary.com/demo/image/upload/v1/newaigent/t1/logo/a.png";
  const photo = "https://res.cloudinary.com/demo/image/upload/v1/newaigent/t1/carousel/b.jpg";
  assert.equal(tenantPreview({ ...BASE, logoUrl: logo, fallbackImage: photo }).image, previewImageUrl(logo));
  assert.equal(tenantPreview({ ...BASE, fallbackImage: photo }).image, previewImageUrl(photo));
  assert.equal(tenantPreview(BASE).image, null);
  // Only https images: an http or relative address would be dropped by the preview reader.
  assert.equal(tenantPreview({ ...BASE, logoUrl: "http://x.com/a.png" }).image, null);
  assert.equal(tenantPreview({ ...BASE, logoUrl: "/logo.png" }).image, null);
});

test("a hosted image is served as a jpg of at most 600 px, which link previews accept", () => {
  assert.equal(
    previewImageUrl("https://res.cloudinary.com/demo/image/upload/v1/newaigent/t1/logo/a.svg"),
    "https://res.cloudinary.com/demo/image/upload/f_jpg,w_600,c_limit/v1/newaigent/t1/logo/a.svg"
  );
  assert.equal(previewImageUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
});
