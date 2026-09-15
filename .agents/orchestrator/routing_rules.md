# Orchestrator — Routing Rules

## Stage Order (Default Happy Path)

```
User Request
    │
    ▼
[BA] requirements → user stories + acceptance criteria
    │
    ▼
[Architect] system design → data model, API contracts, component map
    │
    ▼
[Designer] UI spec → wireframes, tokens, component styling guide
    │
    ▼
[Dev] implementation → code, tests (unit), i18n keys
    │
    ▼
[Code Reviewer] review → pass / request changes
    │  (if changes requested → back to Dev)
    ▼
[Tester] test execution → test plan + results vs acceptance criteria
    │
    ▼
[Security] security scan → dependency audit, secrets check, threat model
    │
    ▼
══ HUMAN GATE: approve production deploy ══
    │
    ▼
[DevOps] deploy → CI/CD pipeline, environment promotion
    │
    ▼
[SRE] monitor → dashboards, alerts, incident triage
    │
    ▼
[Docs] documentation → API docs, changelog, runbook
```

---

## Stage Entry Conditions

| Stage       | Entry Condition |
|-------------|----------------|
| BA          | Raw user request received |
| Architect   | BA user stories + acceptance criteria are `done` |
| Designer    | Architect component map + API contracts are `done` |
| Dev         | Designer spec `done` **and** Architect sign-off `done` |
| Code Review | Dev PR / diff is `done` |
| Tester      | Code review `done` (no open blockers) |
| Security    | Tester results `done` |
| DevOps      | Security `done` **+ human gate approved** |
| SRE         | DevOps deploy `done` |
| Docs        | SRE stable (no P1 incidents open) |

---

## Fast-Track Rules

Short-circuit the full pipeline for:

| Request Type              | Route directly to   | Rationale |
|---------------------------|---------------------|-----------|
| Typo / copy fix           | Dev → Code Reviewer | No arch or design change |
| i18n key addition         | Dev → Code Reviewer | Locale files only |
| CSS token tweak           | Designer → Dev → Code Reviewer | No logic change |
| Dependency version bump   | Security → DevOps   | No app code change |
| Hotfix (prod bug)         | Dev → Code Reviewer → Security → DevOps (expedited human gate) | |
| Docs-only change          | Docs                | |

---

## Rejection / Reroute Rules

| Scenario | Action |
|----------|--------|
| Code Reviewer requests changes | Reroute back to Dev with review notes as input |
| Tester finds P1 bug | Reroute to Dev; block DevOps until re-tested |
| Security finds critical vuln | Block DevOps; notify user; route fix to Dev |
| SRE raises P1 incident | Create new BA task (incident as requirement); notify user |

---

## Agent Ownership Matrix

| Who can reassign tasks? | Target agents |
|-------------------------|---------------|
| Orchestrator (you)      | All |
| User                    | Orchestrator only |
| Individual agents       | Cannot reassign; can only set `blocked` or `done` |
