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

## Hermes setup (bridge)

Any MCP client can fill the newspaper through `bridge/webmcp-bridge.mjs` (Node, deps: `ws`):

1. Run Chrome with remote debugging and open the tab:
   `open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=... http://localhost:3000`
2. Register the bridge in `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  webmcp:
    command: node
    args: ["/absolute/path/to/newspaper-web-mcp/bridge/webmcp-bridge.mjs",
           "--cdp", "http://127.0.0.1:9222", "--url", "http://localhost:3000"]
```

Then ask: "fill the newspaper" — the agent sees `set_date / add_headline / add_story / add_task / clear_paper` as ordinary MCP tools. `bridge/test-messages.ndjson` is a ready-made stdio test transcript.

