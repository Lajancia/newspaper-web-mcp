<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — newspaper-web-mcp

This project is a **WebMCP demo page**: a Next.js newspaper that AI agents fill through
registered tools. If you (the agent) are asked to "fill the newspaper", follow the
procedure below. Do **not** scrape the DOM or use querySelector/innerHTML — the page
publishes a tool contract; call it.

## What this page exposes

Tools are defined in `src/lib/webmcp-register.ts` and mirrored onto
`window.__NEWSPAPER_TOOLS__` (always available) and, on WebMCP-capable browsers
(Chrome 146+ with `chrome://flags/#enable-webmcp-testing`, origin trial from 149),
on `navigator.modelContext` for native agents.

| Tool | Args | Does |
|---|---|---|
| `set_date` | `date` (YYYY-MM-DD) | Sets the edition date in the masthead |
| `add_headline` | `title` (required), `url`, `summary`, `source` | Main headline on top |
| `add_story` | `title`, `body` (required), `url`, `source` | Secondary column story |
| `add_task` | `text` (required), `due` (optional) | To-do sidebar item |
| `clear_paper` | — | Empties the whole edition |

All `execute()` methods are async and return `{ ok: true, ... }`.

## How to fill (bridge path — Hermes and CDP-capable agents)

1. Confirm the tab is open at `http://localhost:3000` (`npm run dev` if not; the tab
   must stay open — tools only exist while the page lives).
2. Discover: evaluate
   `Object.keys(window.__NEWSPAPER_TOOLS__ || {})` in that tab.
3. Call: for each item you collected (news via web search, tasks from the user),
   evaluate `window.__NEWSPAPER_TOOLS__["add_headline"].execute({...})` **in that tab**,
   matching the JSON Schemas above. Pass "function + args" only — no DOM surgery.
4. Verify: read back a rendered element (e.g. `document.querySelector('h3')`)
   or the return values of the calls.

## Native WebMCP path (ChatGPT Desktop, Brave Leo, future Chrome agents)

Enumerate tools via the browser's WebMCP discovery instead of step 2; the tool
names, schemas and semantics are identical.

## Personalized fill — TARA's Daily

The personalized fill recipe is a LOCAL file, intentionally not committed to
this public repo (it references private notes and milestones):

    ~/.hermes/vault_repo/Ghost/03_Working_Knowledge/Tech_Stack/fill-recipe.ko.md

In outline only: briefing of recent progress → upcoming schedule/deadlines →
interest news → today's tasks. Verified data only; deadlines computed in KST
via `date`; news carries real `url` + `source`.

## Rules

- Content data lives only in the open tab's memory. Never add persistence,
  a backend, or server-side storage — that is a hard design constraint of this project.
- Do not modify `src/lib/webmcp-register.ts` tool names/schemas without keeping
  the table above in sync.
- News items should carry real `url` + `source`; never fabricate them.
