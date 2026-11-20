> Moved from `CLAUDE.md` on 2026-11-20. Not loaded automatically: read it when the task needs it.

## Team skills (`common-skills`)

Shared Claude Code skills for the team live in a **private** repo, `smartflows-ai/common-skills` (this repo is public: keep only pointers here, never client data, bank data, tax IDs or private paths). `.claude/settings.json` registers the marketplace `smartflows-skills` and enables the plugin `common-skills`, so opening this repo offers the install. Manual install: `/plugin marketplace add smartflows-ai/common-skills` then `/plugin install common-skills@smartflows-skills`; restart the session after installing or updating.

| Skill | Use it when |
|---|---|
| `newaigent-cliente` | A new client: folder, `ficha.json`, plans, verticals, brand; also how team changes sent in chat are saved per client |
| `newaigent-contrato` | The service contract (DOCX/PDF) by plan and vertical, with amounts, VAT, dates and the exchange-rate adjustment |
| `newaigent-roadmap` | The implementation roadmap deck (PPTX/PDF) |
| `newaigent-informe-configuracion` | The week-1 configuration report, read from the real business data with an automatic audit |
| `newaigent-entrega-bot` | The week-3 delivery: acceptance record, operating guide by role, config diff against week 1, video index |
| `newaigent-manual-video` | Tutorial videos (Remotion) of the real panel, one per module and vertical, with voice, subtitles and licensed music |

Rules that apply when these skills touch this product:
- **Read-only on the real database.** The report and delivery skills read the tenant through `pull-tenant-config.mjs` (only `findUnique`, `findMany`, `count`, `groupBy`, read-only session). It never reads tokens, password hashes, QR codes or patient data. Never change it to write.
- **Videos use their own throwaway database**, never the real one: a local PostgreSQL (port 5544) with fictitious data and a copy of this repo (`git archive`, no `.env`) served on port 3100, started by `demo-entorno.mjs`. Port 3000 is never touched. Schema comes from `prisma migrate diff`, never `db push`.
- **White-label applies to everything they produce:** no provider or model names in client-facing documents or videos. A provider name seen in a capture is a bug of this product: fix it here (see "Vocabulary and White-Labeling Standards").
- **When the product changes**, the videos and the module catalog (`references/modulos.json`, which mirrors `enforcedPlan` in `src/lib/capabilities.ts`) must be refreshed: run `demo-entorno.mjs actualizar`, capture again and regenerate. A new CRM module needs a capture recipe and a script in the skills repo.
- **Where the output goes:** one root folder outside any repo (`NEWAIGENT_HOME`), with the client folders, the video library and the private machine data. Documentation and setup steps are in the skills repo README.
