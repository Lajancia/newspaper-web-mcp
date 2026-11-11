# newspaper-web-mcp

**TARA's Daily** — an agent-filled personal newspaper built on the experimental **WebMCP** standard (W3C Draft CG, Chrome 146+ preview).

The page registers tools on `navigator.modelContext` (and mirrors them onto `window.__NEWSPAPER_TOOLS__`), so an AI agent discovers and calls real functions — `add_headline`, `add_story`, `add_task`, `set_date`, `clear_paper` — instead of scraping the DOM. All rendering lives inside each tool's `execute()`.

## How it works

```
agent ──(discover + call tools)── open tab ── WebMCP ── this page
```

- **Native path**: a WebMCP client agent (e.g. ChatGPT Desktop, Brave Leo) discovers tools through the browser.
- **Bridge path** (current Hermes): agent attaches via CDP, enumerates `window.__NEWSPAPER_TOOLS__`, calls `tool.execute(args)` in-tab. No browser mediation — same contract, different pipe.

## Data model (serverless, by design)

- News/tasks are an **ephemeral per-fill stream** — no persistence, no backend, no server-side user data. Refresh → blank paper.
- Data exists only in the open tab's memory. A deployed copy serves static files only; each visitor's data stays in their own browser.

## Stack

Next.js (App Router) + Tailwind + shadcn/ui. Tools defined in `src/lib/webmcp-register.ts`, state in `src/lib/newspaper-store.ts`.

## Run

```bash
npm install
npm run dev
# http://localhost:3000 — open the tab, then let your agent fill it
```

Note: native WebMCP registration is a feature-checked no-op in browsers without the API (`chrome://flags/#enable-webmcp-testing` on Chrome 146+ / origin trial from 149). The bridge registry (`window.__NEWSPAPER_TOOLS__`) works regardless.

> **Spec-churn warning (July 2026+):** the WebMCP draft moved the API from
> `navigator.modelContext` to `document.modelContext`, and Chrome 150 deprecates the
> `navigator` form. `src/lib/webmcp-register.ts` currently feature-detects
> `navigator.modelContext` only — a `?? document.modelContext` fallback is the
> pending code change before relying on native registration on newer Chrome.

## What this is — and honestly, what it isn't

The **page side is WebMCP**: real tool registration with JSON Schemas, ready for a
native client the day one ships. The **client side today is not**: no mainstream
agent consumes `modelContext` tools yet (the first real consumers are ChatGPT
Desktop's built-in browser, and — when it ships — Gemini in Chrome). Every fill
that has happened so far went through a bypass layer, not through browser
mediation. That is the designed transition path, not a failure: the contract ships
today, the pipe arrives later.

## Testing natively (real WebMCP, browser-mediated)

1. **Model Context Tool Inspector** extension (Chrome Web Store) — the official
   Google test path. Open `localhost:3000`, it discovers the registered tools and
   calls them via Gemini API key. No deployment, no subscription needed.
2. **ChatGPT Desktop** — built-in browser consumes WebMCP tools. Requires the page
   to be reachable at a real URL (deploy to a domain or tunnel localhost).
3. **Brave Leo** — experimental WebMCP support; browser+client in one install.

## Pitfalls learned the hard way

- Filling in a headless/agent-only browser is invisible to the user — demo in a
  **visible** browser (debug-enabled dedicated profile, never the main profile).
- The stdio bridge is **stateful on the gateway side**: after editing the wrapper,
  kill stale bridge processes or the old CDP port keeps being used.
- `clear_paper` resets the date too — call `set_date` **after** `clear_paper`.
- macOS AppleScript JS runs in an isolated world (can't see page globals). Workaround:
  inject a `<script>` tag with base64-encoded fill code, run in the main world,
  report via `document.title`, poll for it. See `docs/webmcp-journey.ko.md`.
- Tool args are untrusted: `javascript:`/`data:` URLs are XSS via click, control
  characters break headlines, free-text needs length caps. `src/lib/sanitize.ts`
  handles this — keep it in the loop for any new tool.

## Hermes setup (bridge)

Any MCP client can fill the newspaper through `bridge/mcp-serve.sh` (wrapper that
auto-detects a debug Chrome CDP port: `$NEWSPAPER_CDP` → visible debug Chrome
(9223/9222) → harness profile ports last) running `bridge/webmcp-bridge.mjs`
(Node, deps: `ws`). Other files in `bridge/`: `test-messages.ndjson` (ready-made
stdio test transcript) and `verify9223.mjs` (renders a fill through raw CDP).

1. Run Chrome with remote debugging and open the tab:
   `open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=... http://localhost:3000`
2. Register the wrapper as the MCP server command (point at it by absolute path
   — the wrapper resolves the repo root itself):

```yaml
mcp_servers:
  webmcp:
    command: node
    args: ["/absolute/path/to/newspaper-web-mcp/bridge/webmcp-bridge.mjs",
           "--cdp", "http://127.0.0.1:9222", "--url", "http://localhost:3000"]
```

Then ask: "fill the newspaper" — the agent sees `set_date / add_headline / add_story / add_task / clear_paper` as ordinary MCP tools. `bridge/test-messages.ndjson` is a ready-made stdio test transcript.

