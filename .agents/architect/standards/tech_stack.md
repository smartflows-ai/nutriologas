# Tech Stack Reference

> Read-only reference for the Architect agent. Source of truth is `CLAUDE.md`.

## Frontend

| Concern | Technology | Notes |
|---------|-----------|-------|
| Framework | React 18 | Functional components + hooks only |
| Build | Vite | `npm run dev` · `npm run build` |
| Router | React Router v7 | Routes in `src/App.jsx` |
| Styling | Vanilla CSS | Global tokens in `src/index.css` |
| Icons | lucide-react | |
| Charts | Recharts | |
| Code editor | @monaco-editor/react | Lazy-load only on challenge screen |
| PDF parsing | pdfjs-dist | Dynamic import, not on initial bundle |
| Animations | framer-motion | Installed, light usage |
| i18n | react-i18next | EN + ES locale files |

## Backend

| Concern | Technology | Notes |
|---------|-----------|-------|
| Database | Firebase Firestore | Real-time listeners |
| Auth | Firebase Auth | Staff = email/password, Candidates = anonymous |
| AI proxy | Cloudflare Worker | `worker/src/index.js` |
| LLM router | OpenRouter | `worker/src/openrouter.js` |
| Fast model | claude-haiku-3.5 | Live suggestions, custom prompts |
| Heavy model | claude-sonnet-4.5 | Evaluation, CV analysis |

## Infrastructure

| Concern | Technology |
|---------|-----------|
| Frontend hosting | Firebase Hosting |
| Worker hosting | Cloudflare Workers |
| Secrets | Cloudflare `wrangler secret` |
| Env vars (app) | `.env` with `REACT_APP_` prefix |

## Key Constraints

- No Tailwind.
- No CRA.
- No hardcoded model names in route handlers.
- No `console.log` in committed code.
- `Room.jsx` < 2000 lines.
