#!/usr/bin/env node
/**
 * WebMCP ⇄ MCP bridge (serverless newspaper companion).
 *
 * Hermes (or any MCP client) ──stdio JSON-RPC── this bridge ──WS/CDP── Chrome tab
 *
 * tools/list → reads window.__NEWSPAPER_TOOLS__ (names + schemas) from the tab
 * tools/call → executes tool.execute(args) in-tab, returns the result
 *
 * Usage: node bridge/webmcp-bridge.mjs [--cdp http://localhost:9222] [--url http://localhost:3000]
 */

import WebSocket from "ws";
import readline from "node:readline";

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}
const CDP_HTTP = arg("--cdp", "http://127.0.0.1:9222");
const PAGE_URL = arg("--url", "http://localhost:3000");

// ---- minimal JSON-RPC over stdio ----
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

const PROTOCOL = {
  protocolVersion: "2024-11-05",
  capabilities: { tools: {} },
  serverInfo: { name: "webmcp-bridge", version: "0.1.0" },
};

// ---- CDP plumbing ----
let ws = null;
let wsReady = null;
let msgId = 0;
const pending = new Map();

let connectPromise = null;

function connectCdp() {
  if (ws && ws.readyState === 1) return Promise.resolve();
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
  const res = await fetch(`${CDP_HTTP}/json/list`);
  const targets = await res.json();
  const page = targets.find(
    (t) => t.type === "page" && t.webSocketDebuggerUrl && t.url.startsWith(PAGE_URL)
  );
  if (!page) {
    throw new Error(
      `No tab matching ${PAGE_URL}. Open it in Chrome (started with --remote-debugging-port) first.`
    );
  }
  try {
    await new Promise((resolve, reject) => {
      ws = new WebSocket(page.webSocketDebuggerUrl);
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        }
      });
      ws.once("open", resolve);
      ws.once("error", reject);
    });
  } catch (e) {
    ws = null;
    connectPromise = null;
    throw e;
  }
  })();
  return connectPromise;
}

async function cdpEval(expression) {
  await connectCdp();
  const id = ++msgId;
  const p = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  ws.send(
    JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: { expression, awaitPromise: true, returnByValue: true },
    })
  );
  const r = await p;
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || "page eval failed");
  }
  return r.result?.value;
}

// ---- MCP handlers ----
const FILL_INSTRUCTION = `Bridge to a WebMCP newspaper page. tools/list exposes the page's registered tools; call them to fill the newspaper. The page tab must stay open.`;

async function listTools() {
  const tools = await cdpEval(
    `Object.entries(window.__NEWSPAPER_TOOLS__ || {}).map(([name, t]) => ({
      name,
      description: t.description || "",
      inputSchema: t.inputSchema || { type: "object" },
    }))`
  );
  if (!Array.isArray(tools)) throw new Error("page tools not found (tab open?)");
  return { tools: tools.map((t) => ({ ...t, _meta: { webmcp: true } })) };
}

async function callTool(name, argsObj) {
  const result = await cdpEval(
    `(async () => {
      const t = (window.__NEWSPAPER_TOOLS__ || {})[${JSON.stringify(name)}];
      if (!t) throw new Error("unknown tool: ${name}");
      return await t.execute(${JSON.stringify(argsObj ?? {})});
    })()`
  );
  return {
    content: [{ type: "text", text: JSON.stringify(result ?? { ok: false }) }],
  };
}

const REQUESTS = {
  initialize: () => PROTOCOL,
  "notifications/initialized": () => null, // notification, no reply
  "ping": () => ({}),
  "tools/list": listTools,
  "tools/call": (p) => callTool(p.name, p.arguments),
};

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const line2 = line.trim();
  if (!line2) return;
  let msg;
  try {
    msg = JSON.parse(line2);
  } catch {
    return;
  }
  if (!msg.id) return; // notification
  const handler = REQUESTS[msg.method];
  if (!handler) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    return;
  }
  Promise.resolve(handler(msg.params))
    .then((result) => send({ jsonrpc: "2.0", id: msg.id, result }))
    .catch((e) =>
      send({
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32000, message: String(e.message || e) },
      })
    );
});

// keep alive
setInterval(() => {}, 1 << 30);
