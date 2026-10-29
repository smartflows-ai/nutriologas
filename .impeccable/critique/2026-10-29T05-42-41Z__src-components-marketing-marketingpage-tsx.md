---
target: "home page http://localhost:3000/ (MarketingPage)"
total_score: 19
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/Users/luis/Documents/Nutriologas/nutriologas/src/components/marketing/MarketingPage.tsx"
target_fingerprint: "sha256:8d94d843407885f6145a67441a26d3366597bf4a9c8ee7766f18ee8eec038a2e"
target_path: /Users/luis/Documents/Nutriologas/nutriologas/src/components/marketing/MarketingPage.tsx
timestamp: 2026-10-29T05-42-41Z
slug: src-components-marketing-marketingpage-tsx
---
Method: dual-agent (design-review agent + detector/browser agent). Target: http://localhost:3000/ (root-domain marketing page, MarketingPage.tsx + src/components/marketing/*). Mode: Persuade. Analysis only, no edits.

Score: 19/32 (heuristics 7 and 10 n/a for Persuade). Rating: Acceptable (59%).
Detector: 1 finding (animate-bounce, CTASection.tsx:34). Lighthouse desktop: A11y 94, BP 100, SEO 100; failing: color-contrast, heading-order (footer h4).

Heuristic scores: 1=2 2=3 3=3 4=2 5=3 6=3 8=1 9=2

Priority issues
- [P1] Primary CTA scrolls to pricing instead of opening signup; CTA labels inconsistent (MarketingPage.tsx:33,39). Command: clarify, harden.
- [P1] Hero noisy, unsourced numbers, no reduced-motion handling (HeroSection.tsx:48-362). Command: distill, layout.
- [P1] Demo video has no poster; WhatsApp booking buried among six equal cards (DemoSection.tsx:59-70). Command: shape, bolder.
- [P2] Unverifiable, unnamed social proof placed after pricing. Command: clarify.
- [P2] Pricing: 4 vertical tabs + toggle + 3 plans; Enterprise opens mailto. Command: distill, adapt.

Craft-floor flags: pill/kicker above H2 in 5+ sections; gradient text on nearly every H2.
Evidence: html lang fixed to en; no og:image; duplicate API calls (/api/billing/prices, /api/auth/session); mascot image sizes warning.
