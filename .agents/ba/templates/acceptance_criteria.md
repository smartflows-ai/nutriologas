# Acceptance Criteria

**Story ID**: <!-- US-YYYY-MM-DD-NNN (links to user_story.md) -->  
**Author**: BA Agent  
**Reviewed by**: <!-- Orchestrator / Human -->

---

## Criteria

Write each criterion in **Given / When / Then** format.  
Prefix with `AC-NNN` for traceability.

### AC-001 — [Short title]

- **Given** 
- **When** 
- **Then** 

### AC-002 — [Short title]

- **Given** 
- **When** 
- **Then** 

<!-- Add more AC-NNN blocks as needed -->

---

## Non-Functional Requirements

| Requirement | Threshold |
|-------------|-----------|
| Performance | <!-- e.g. page loads < 2s on 3G --> |
| Accessibility | <!-- e.g. keyboard navigable, ARIA labels --> |
| i18n | <!-- list any new t() keys expected --> |
| Browser support | <!-- Chrome 120+, Firefox 120+, Safari 17+ --> |

---

## Definition of Done

- [ ] All AC-NNN criteria pass in Tester's test run.
- [ ] Build passes `npm run build` with zero errors.
- [ ] No `console.log` in committed code.
- [ ] All new user-visible strings use `t()` with keys in both locale files.
- [ ] Code Reviewer approved (no open blockers).
- [ ] Security scan clean.
