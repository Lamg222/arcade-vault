# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical: read the bundled Next.js docs first

This project uses **Next.js 16.2.9** (with React 19.2.4 and Tailwind CSS v4) — a version newer than your training data. APIs, conventions, and file structure may differ from what you know. Before writing or changing any Next.js / React / Tailwind code, read the relevant guide under `node_modules/next/dist/docs/`:

- `01-app/` — App Router (this project uses the App Router, in `app/`)
- `02-pages/` — Pages Router
- `03-architecture/` — internals
- `04-community/` — community resources
- `index.md` — table of contents

Heed deprecation notices in those docs.

## Architecture

- **App Router** under `app/`: `layout.tsx` (root layout — loads Geist fonts via `next/font/google`, sets `<html>`/`<body>` shell) and `page.tsx` (the home route). Add routes as folders with `page.tsx` under `app/`.
- **Styling**: Tailwind CSS v4 via PostCSS (`postcss.config.mjs`). Theme is configured in CSS, not a JS config — see the `@import "tailwindcss"` and `@theme inline { ... }` block in `app/globals.css`. Light/dark colors come from CSS variables (`--background`, `--foreground`) switched by `prefers-color-scheme`.
- **Imports**: `@/*` maps to the project root (`tsconfig.json` `paths`). TypeScript is `strict`.
- The current `app/page.tsx` is still the default scaffold landing page; replace it when building real screens.

## Product context

Arcade Vault is a platform to play games online and compete for the highest score (see `README.md`). The project follows Spec Driven Design using the `/spec` and `/spec-impl` skills (from `Klerith/fernando-skills`).


## Style

Utiliza /frontend-desing para hacer los cambios en la interfaz de usuario.

