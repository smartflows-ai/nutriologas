# Changelog

All notable changes to Presto AI are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2] — 2026-07-21

### Added
- Interview date + time picker in `ScheduleInterviewModal` — sessions now expire at 23:59:59 local on the selected interview date.
- `interviewDate` (YYYY-MM-DD) and `interviewTime` (HH:MM) fields persisted to Firestore session doc.
- Fullscreen AI evaluation loading overlay in `Room.jsx` — blocks UI during report generation with stage-by-stage progress (closing → generating → saving → auditing).
- Multi-agent SDLC team scaffolded under `.agents/` — Orchestrator, BA, Architect, Designer, Dev, Code Reviewer, Tester, Security, DevOps, SRE, Docs.

### Changed
- Session TTL logic changed from fixed 3-hour window to end-of-selected-day expiry.
- "Ask Claude now" / "Ask Claude anything" AI co-pilot UI renamed to **Presto AI** across all components, document titles, and locale strings.
- `generatingReport` locale key updated to "Generating AI Report…".

### Fixed
- Positions page loading indefinitely ("Loading…") — resolved in `PositionsManager.jsx`.

---

## [1.1] — 2026-07

### Added
- Jitsi mirror fallback system (element.io → jit.si).
- Mute sync: Jitsi mic mute state disables `useTranscription`.
- Session auto-completion bug fix: leaving video call no longer sets `status: 'completed'`.
- Link regeneration modal (`RegenerateLinkModal`) in Room + PositionDetail.
- Favicon + PWA manifest.
- EN / ES internationalization (react-i18next).

---

## [1.0] — 2026-07

### Added
- Initial release: login, admin dashboard, positions CRUD, interview scheduling, live room (transcription + Q&A + challenges), session evaluation, CV pre-screen analysis, candidate comparison.
