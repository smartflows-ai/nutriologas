# Booking Flow Visual Polish (ECC + Impeccable workflow test)

## Problem
The visual quality of the public booking flow has not been assessed as a problem. This work exists to evaluate the ECC + Impeccable workflow on branch `experimental/ecc`, using a small, real screen as the test subject. Leaving it undone costs nothing user-facing; the cost is not knowing whether the workflow is worth adopting.

## Evidence
- Assumption — needs validation via prototype. The visual quality problem is unproven; the real purpose is to evaluate the workflow.

## Users
- **Primary**: The developer evaluating the ECC + Impeccable workflow, who needs a reviewable, low-risk change to judge process quality and cost.
- **Not for**: Tenants and patients as a validated audience (no user research done); the marketing/landing page audience.

## Hypothesis
We believe running `/ecc:plan-prd` -> `/ecc:plan` -> `/impeccable` on one screen will produce a reviewable, rule-compliant UI improvement for the developer evaluating the workflow.
We'll know we're right when the change passes the `CLAUDE.md` style rules and the Impeccable checks, and the token cost and effort are measurable from `/context` and `/cost`.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| `CLAUDE.md` style rules violated | 0 | Review plus the Impeccable hook |
| Screens changed | 1 | `git diff --stat` |
| Added token cost for the whole flow | Recorded, no target | `/context`, `/cost` |

## Scope
**MVP** — One screen: the public booking flow (`/agendar/[slug]`, the `BookingFlow` component), which is public, shared by every bookable vertical, and small enough for one diff.

**Out of scope**
- Other storefront pages — keeps the test to a single reviewable diff
- The rest of the CRM — larger surface, separate effort
- Marketing/landing pages — they use the dark NewAigent brand style, not the tenant style
- New features, behavior or data changes — this is styling only
- Adding a test runner — separate task

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Booking flow restyled | The booking flow looks consistent with the tenant theme and passes the style rules, for any vertical, in light and dark mode | pending | — |
| 2 | Workflow evaluation recorded | Token cost, hook noise and rule conflicts are noted for the ECC + Impeccable decision | pending | — |

## Open Questions
- [ ] Does Impeccable's output conflict with the tenant-theme rule (hardcoded colors) or the minimal flat style in `.claude/skills/minimal-ui`?
- [ ] Is the Impeccable hook (PostToolUse and Stop) too noisy on a small change?
- [ ] What counts as a measurable pass for the visual result, given there is no baseline?

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Impeccable introduces hardcoded colors, gradients or emojis that break `CLAUDE.md` rules | Medium | Medium | Review the diff against the style rules; keep the change to one screen |
| Booking flow differs per vertical (pets fields for VETERINARY and PET_CARE) and a change breaks one | Medium | Medium | Check at least one pet vertical and one non-pet vertical, empty and long values, dark mode |
| Hook runs add cost or noise | Medium | Low | Record it as part of the evaluation |
| Result judged subjectively with no baseline | High | Low | Capture before/after screenshots |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
