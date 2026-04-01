# MeauxCAD Studio / AITestSuite

Cloud-native, agent-first IDE shell for 3D and full-stack work. This repository is the **source of truth** for the dedicated **AITestSuite** Worker on Cloudflare. The GitHub project name remains **meauxcad**; the deployed Worker name is **aitestsuite**.

**Live app:** [https://aitestsuite.meauxbility.workers.dev/](https://aitestsuite.meauxbility.workers.dev/)

**Repository:** [https://github.com/SamPrimeaux/meauxcad](https://github.com/SamPrimeaux/meauxcad)

---

## Role in the Inner Animal Media stack

AITTestSuite is **Step 1** in the IAM delivery path: an independent sandbox for fast UI, Monaco, Excalidraw, in-IDE browser, and AI provider experiments. It does **not** replace the main CIDI sandbox.

| Layer | Worker / surface | Purpose |
|--------|------------------|---------|
| **Lab (this repo)** | `aitestsuite` | Rapid iteration; own secrets; no production user traffic |
| **CIDI sandbox** | `inneranimal-dashboard` | Full IAM mirror, `deploy-sandbox.sh`, benchmark gate |
| **Production** | `inneranimalmedia` | Live product at inneranimalmedia.com |

Approved patterns from this repo are **ported** into the [march1st-inneranimalmedia](https://github.com/SamPrimeaux/inneranimalmedia-agentsam-dashboard) monorepo, then deployed through sandbox benchmarks and promote-to-prod. See IAM docs in that repo: `docs/AITESTSUITE_IAM_STACK_INTEGRATION.md` (conceptual runbook).

---

## Overview

MeauxCAD Studio is a desktop-style IDE built on the Cloudflare stack (Workers, D1, R2). It is meant as a shared workspace where an AI agent and a human developer stay in sync across code, 3D assets, terminal output, and previews.

**Cloudflare Workers Builds** (optional): connect this repository to the `aitestsuite` Worker with branch `main`, build command `npm run build`, deploy `npx wrangler deploy`. Keep `wrangler.jsonc` `name` aligned with the Worker name (`aitestsuite`).

---

## Features

### Monaco Editor

- File System Access API for real read/write to a connected folder where the browser allows it.
- Dirty-state indicators and discard flows.
- Diff-style workflows for local vs buffered content.
- Broad language support (TypeScript, Python, Rust, Go, SQL, and more).

### Terminal and agent bridge

- XTerm.js shell with a tabbed drawer (terminal, output, problems).
- Agent-oriented flows for injecting commands and streaming output.

### AI agent

- Context from the active file and workspace where implemented.
- Google Gemini integration (`@google/genai`); configure API keys via Worker secrets for deployed builds.
- Artifacts and editor/terminal integration paths as built in the app.

### 3D and preview

- Voxel tooling and GLB viewing (Three.js / model-viewer where wired).
- In-IDE browser tab for loading external sites without leaving the shell.

---

## Tech stack

| Area | Choice |
|------|--------|
| UI | React 19, Vite 6 |
| Editor | Monaco (`@monaco-editor/react`) |
| Drawing | Excalidraw (`@excalidraw/excalidraw`) |
| Terminal | XTerm.js |
| 3D | three.js, cannon-es, `@google/model-viewer` |
| Edge | Cloudflare Workers (`worker.ts`), Wrangler 4 |
| Data | D1 (`inneranimalmedia-business` in config), R2 buckets for CAD / assets (see `wrangler.jsonc`) |
| Observability | Workers Logs / Traces; optional tail consumer to `inneranimalmedia-tail` |

Secrets (set on the Worker, never commit): e.g. `GEMINI_API_KEY`, `OPENAI_API_KEY`, and others as required by your routes.

---

## Prerequisites

- Node.js 18+
- npm
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed as a dev dependency; use `npx wrangler`)

---

## Local development

```bash
git clone https://github.com/SamPrimeaux/meauxcad.git
cd meauxcad
npm install
```

Create `.env.local` (or use Wrangler secrets) for Gemini and any other provider keys your dev server expects.

```bash
npm run dev
```

Vite serves the frontend; API behavior that depends on the Worker should be tested with `wrangler dev` or a deployed preview as needed.

---

## Build and deploy

```bash
npm run build
```

Production deploy (bumps cache script, builds, deploys Worker + assets):

```bash
npm run deploy
```

Ensure `wrangler.jsonc` `name` matches the Cloudflare Worker (**aitestsuite**). For CI/CD via Cloudflare Git integration, the same commands should match your dashboard: **Build:** `npm run build`, **Deploy:** `npx wrangler deploy`.

---

## Project layout

| Path | Role |
|------|------|
| `App.tsx` | IDE shell orchestration |
| `worker.ts` | Worker routes, API, persistence |
| `components/` | Monaco, terminal, chat, and feature UI |
| `services/` | API and integration helpers |
| `utils/` | FS helpers and shared utilities |
| `scripts/` | Deploy helpers (e.g. cache bump) |
| `wrangler.jsonc` | Worker name, bindings, D1, R2, DO, assets |

---

## Contributing

Issues and PRs are welcome for bug fixes, features, and documentation. For changes that must ship on **inneranimalmedia.com**, coordinate with the main IAM monorepo workflow (sandbox first, then production promote).

---

## License and credits

Built by Sam Primeaux. Inner Animal Media / IAM platform integration is documented in the primary monorepo.

**Historical note:** The public Workers.dev hostname was updated to **aitestsuite**; older references to `meauxcad.meauxbility.workers.dev` or deprecated `aitesting` hosts should be treated as superseded by [aitestsuite.meauxbility.workers.dev](https://aitestsuite.meauxbility.workers.dev/).
