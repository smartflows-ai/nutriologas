# Deploy Runbook

> Maintained by the Docs agent. Updated on every environment or pipeline change.

---

## Prerequisites

```bash
# Node version
node -v  # >= 18

# Firebase CLI
npx firebase --version

# Wrangler CLI
npx wrangler --version
```

Secrets: `OPENROUTER_KEY` must be set via:
```bash
npx wrangler secret put OPENROUTER_KEY
```

---

## Local Development

```bash
# Terminal 1 — React app
npm run dev
# Accessible at http://localhost:5173

# Terminal 2 — Cloudflare Worker
npx wrangler dev --port 8787
# REACT_APP_AI_WORKER_URL=http://localhost:8787 in .env
```

---

## Staging Deploy

```bash
# Build app
npm run build

# Deploy frontend to Firebase staging preview channel (7-day TTL)
npx firebase hosting:channel:deploy staging --expires 7d

# Deploy worker to Cloudflare staging env
npx wrangler deploy --env staging
```

---

## Production Deploy

> ⚠️ **Human gate required.** Orchestrator must confirm approval before running these commands.

```bash
# Build
npm run build

# Deploy frontend to Firebase Hosting (live)
npx firebase deploy --only hosting

# Deploy worker to Cloudflare production
npx wrangler deploy --env production

# Deploy Firestore rules (if changed)
npx firebase deploy --only firestore:rules
```

---

## Rollback

```bash
# Frontend — roll back to previous Firebase release
npx firebase hosting:rollback

# Worker — roll back to previous Cloudflare deploy
npx wrangler deployments rollback

# Firestore rules rollback — manual: restore previous firestore.rules and redeploy
npx firebase deploy --only firestore:rules
```

---

## Smoke Test After Deploy

1. Open the production URL and verify the login page loads.
2. Log in as an interviewer and verify the admin dashboard renders.
3. Navigate to a position and verify positions load (not stuck on "Loading…").
4. Schedule a new interview — verify the date picker appears and session doc is created.
5. Check the Cloudflare Worker logs for any 500 errors.
