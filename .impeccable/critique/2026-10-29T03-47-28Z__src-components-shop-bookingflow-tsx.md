---
target: public booking flow BookingFlow.tsx
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/luis/Documents/Nutriologas/nutriologas/src/components/shop/BookingFlow.tsx"
target_fingerprint: "sha256:cc254e1c148ceffb3d6db8ccfff4862c0ae46ca899b0119a50efba958640b0db"
target_path: /Users/luis/Documents/Nutriologas/nutriologas/src/components/shop/BookingFlow.tsx
timestamp: 2026-10-29T03-47-28Z
slug: src-components-shop-bookingflow-tsx
---
Method: dual-agent (design-review agent + detector agent). Browser visualization not run (needs tenant/DB data).

Score: 22/40 (all 10 heuristics applied). Rating: Acceptable. Detector: [] (clean). Manual rule check found project-rule violations the detector does not cover.

Heuristic scores: 1=2 2=3 3=2 4=2 5=2 6=2 7=2 8=2 9=2 10=2

Priority issues
- [P1] White text on bg-primary assumes a dark tenant color (L225, L279, L293, L309, L334, L350, L480, L484). Fix: luminance-based on-primary token. Command: colorize, harden.
- [P1] Hardcoded amber/rose boxes (L319, L464), scale-105 on selected day (L293), extrabold weights. Fix: neutral no-slots, one danger token, selection by border/fill/check. Command: quieter, polish.
- [P1] Accessibility: labels without htmlFor/id (L356, L407, L435, L449), no aria-pressed on day/slot buttons, no role=alert, h3 under h1, no focus-visible. Command: harden.
- [P2] Missing states: failed availability fetch (L99), stale-request guard, empty availableDays, non-bookable product. Command: harden.
- [P2] Blind submit and thin success: no recap near CTA, raw ISO date (L204), pet name missing, WhatsApp CTA ambiguity. Command: clarify, distill.

Evidence: animate-fade-in (L177), scale-102 (L334), scrollbar-none (L283) are undefined Tailwind classes (silent no-ops). console.error at L99. Pet labels use t.crm.* namespace on a storefront screen.
