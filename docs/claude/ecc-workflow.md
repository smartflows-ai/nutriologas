> Moved from `CLAUDE.md` on 2026-11-20. Not loaded automatically: read it when the task needs it.

## ECC Workflow (Everything Claude Code)

> Project rules in this file always win over generic ECC rules.

### Install scope
- ECC is installed **only as a Claude Code plugin** (`ecc@ecc`, enabled in `.claude/settings.local.json`, hook profile `minimal`).
- **Never** run `install-apply.js` or `install.sh` on top of the plugin. Mixing both methods duplicates skills, commands and hooks.
- Rules are copied by hand, whole folders only: `.claude/rules/ecc/common` and `.claude/rules/ecc/typescript`. Do not add other language packs (token cost).
- The old `.agents/` scaffold (from another project) was removed. Claude Code does not need an `AGENTS.md`. Its useful history now lives in `docs/DECISIONS-LEDGER.md` and `docs/CHANGELOG.md`.

### Standard flow
```
/ecc:plan-prd -> /ecc:plan (wait for CONFIRM) -> tdd-workflow skill -> /ecc:code-review -> /ecc:pr
```
- Use `/ecc:build-fix` when the build breaks, `/ecc:security-scan` before shipping auth, payment or tenant code.
- Run `/ecc:update-codemaps` after large features or refactors, then review the diff before committing.
- Playbook (install rules, command map, hooks): https://claude.ai/artifact/5LaD5NNMcgZ2NN1X3T62ey
- After writing a plan, always open it with `/ecc:plan-canvas` and wait for the verdict; do not just offer it. No code until the canvas verdict is approve or the user confirms in chat.
- For browser checks with the ECC browser: save screenshots outside the repo or in a git-excluded folder (they show real names, phones and e-mails and the repo is public), and stop before submitting any form; the user submits it.

### `/n8n` command (read-only inspection of the n8n instance)
- Defined in `.claude/commands/n8n.md` with `disable-model-invocation: true`: it runs only when the user types it, never because the topic came up.
- Needs `N8N_API_URL` and `N8N_API_KEY` in `.env` (see `.env.example`). It only does `GET`: whether a workflow is active, its schedule, its last executions and what it calls. The workflows are not in the repo, so the live instance is the source of truth.
- It never prints raw workflow JSON (the workflows hold hardcoded secrets and the repo is public). Before any approved write to n8n it saves the full JSON **outside the repo** (`~/.n8n-backups/`, owner-only), and it asks with `AskUserQuestion` naming the workflow, the exact change and the backup path. Approval of a plan is not approval of the write.

### n8n MCP server (second way to reach the n8n instance)
- Besides `/n8n` (REST, `N8N_API_KEY`), the n8n instance exposes an MCP endpoint: `https://n8n.smart-flows.tech/mcp-server/http`. It is added per developer in their own Claude Code config (scope `local`, the default, which lives in `C:\Users\<user>\.claude.json`): `claude mcp add --transport http n8n-mcp https://n8n.smart-flows.tech/mcp-server/http --header "Authorization: Bearer <token>"`.
- The token is the one from n8n > Settings > MCP Access (instance-level MCP), **not** `N8N_API_KEY`. A 401 means a wrong, expired or regenerated token, or MCP Access turned off.
- **Never** put the token in the repo: not in `.mcp.json` (project scope), not in `.claude/settings.local.json`, not in `.claude/.claude.json`, not in chat. The repo is public.
- The server name is `n8n-mcp`. Check with `/mcp` (state and tool count) or `claude mcp list`. A server added or reconnected after a session started is not picked up by that session: restart the session to get its tools. A "version negotiation timed out" on first connect usually means a slow start (for an `npx` server, run it once to fill the cache, or start Claude Code with `MCP_TIMEOUT=30000`).
- Same rules as `/n8n`: reads are free; any write (import, edit, activate or deactivate a workflow) needs explicit approval in chat, with a backup of the current workflow saved outside the repo first. Never print raw workflow JSON.
- Status (2026-11-06): connected in the other sessions of the owner; the chat session had to be restarted to load it. The chat workflow `n8n-chat-workflow-v2.json` is still imported by hand until the code is deployed.

### Human gate and re-route rules
Kept in `CLAUDE.md` (loaded on every message), so there is one copy.
### Architecture docs
Token-lean maps live in `docs/CODEMAPS/`: `architecture.md`, `backend.md`, `frontend.md`, `data.md`, `dependencies.md`. Read the relevant map before exploring code. Regenerate them instead of editing by hand.

### Precedence over ECC rules
When an ECC rule conflicts with this file, this file wins. In particular:
- Tenant isolation (`tenantId` from the session, never from input), `@/lib/db` for Prisma, white-label vocabulary, i18n, no emojis, minimal UI and tenant theme tokens are mandatory.
- The ECC rules for 80% coverage and TDD are the target. The repo has no coverage tool or CI test step yet, but pure logic is tested with `node:test` through `tsx` in `local-utils/*.test.ts` (`npx tsx --test tests/*.test.ts`): write the failing test first, then the code. Logic that talks to the database or the network is built with its I/O injected so it can be tested without them (see `src/lib/reminder-run.ts`). Adding a real runner and coverage is a separate task.
- The ECC "never mutate" rule applies to new code. Do not rewrite existing Prisma or Zustand code only to satisfy it.

### Known gaps (verified 2026-11-03)
- `n8n/workflows/` is cited in this file but does not exist in this checkout. Treat it as external: the live n8n instance is the source of truth (use `/n8n`). `local-utils/` now exists with tests and utilities.
- Upstash Redis is listed in the env vars but no code under `src/` uses it.

---
