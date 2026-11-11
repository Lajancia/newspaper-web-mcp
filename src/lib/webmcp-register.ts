"use client";

/**
 * WebMCP tool registration for the newspaper page.
 *
 * Strategy:
 *  - Tools are defined ONCE here with real JSON Schemas.
 *  - If the browser supports WebMCP (Chrome 146+ w/ flag, or origin-trial builds),
 *    they are registered on navigator.modelContext — native agents discover them.
 *  - Regardless of support, they are mirrored onto window.__NEWSPAPER_TOOLS__
 *    so a CDP-based bridge (Hermes) can enumerate and call tool.execute() in-tab
 *    even before WebMCP lands natively.
 *
 * All rendering/state logic lives in execute(); the agent only passes
 * "function + args" — never DOM surgery.
 */

import {
  addHeadline,
  addStory,
  addTask,
  clearPaper,
  setPaperDate,
} from "./newspaper-store";
import { safeUrl, safeText } from "./sanitize";

type ModelContextLike = {
  registerTool: (t: unknown) => void;
};

type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};

export function buildTools(): WebMCPTool[] {
  return [
    {
      name: "set_date",
      description: "Set the edition date of today's newspaper (YYYY-MM-DD).",
      inputSchema: {
        type: "object",
        properties: { date: { type: "string", description: "YYYY-MM-DD" } },
        required: ["date"],
      },
      execute: async (a) => setPaperDate(safeText(String(a.date), 10)),
    },
    {
      name: "add_headline",
      description:
        "Add one main headline to the top of the newspaper. The agent picks it from news it collected.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          summary: { type: "string", description: "1-2 sentence summary" },
          source: { type: "string" },
        },
        required: ["title"],
      },
      execute: async (a) =>
        addHeadline({
          title: safeText(String(a.title), 200),
          url: safeUrl(a.url ? String(a.url) : undefined),
          summary: safeText(a.summary ? String(a.summary) : undefined, 500),
          source: safeText(a.source ? String(a.source) : undefined, 100),
        }),
    },
    {
      name: "add_story",
      description:
        "Add a secondary story into a newspaper column (shorter than the headline).",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string", description: "1-3 sentences" },
          url: { type: "string" },
          source: { type: "string" },
        },
        required: ["title", "body"],
      },
      execute: async (a) =>
        addStory({
          title: safeText(String(a.title), 200),
          body: safeText(String(a.body), 1000),
          url: safeUrl(a.url ? String(a.url) : undefined),
          source: safeText(a.source ? String(a.source) : undefined, 100),
        }),
    },
    {
      name: "add_task",
      description: "Add an item to today's to-do sidebar.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
          due: { type: "string", description: "optional, e.g. 18:00" },
        },
        required: ["text"],
      },
      execute: async (a) =>
        addTask({
          text: safeText(String(a.text), 200),
          due: a.due ? safeText(String(a.due), 20) : undefined,
        }),
    },
    {
      name: "clear_paper",
      description:
        "Empty the whole newspaper (start a fresh edition). Use before filling a new day.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => clearPaper(),
    },
  ];
}

/** Registry used by the CDP bridge: window.__NEWSPAPER_TOOLS__ */
export function installBridgeRegistry(tools: WebMCPTool[]) {
  if (typeof window === "undefined") return;
  const reg: Record<string, WebMCPTool> = {};
  for (const t of tools) reg[t.name] = t;
  (window as unknown as Record<string, unknown>).__NEWSPAPER_TOOLS__ = reg;
}

/** Native WebMCP registration (silent no-op where unsupported). */
export function tryRegisterWebMCP(tools: WebMCPTool[]) {
  if (typeof window === "undefined") return "no-window";
  // Spec churn: the draft moved the API to document.modelContext (July 2026);
  // Chrome 150 deprecates the navigator form. Feature-detect both.
  const mc =
    (navigator as unknown as { modelContext?: ModelContextLike }).modelContext ??
    (document as unknown as { modelContext?: ModelContextLike }).modelContext;
  if (!mc) return "unsupported"; // feature-check: do NOT treat as success
  try {
    for (const t of tools) mc.registerTool(t);
  } catch (e) {
    // HMR / double-call: Chrome throws InvalidStateError "Duplicate tool name".
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate/i.test(msg)) return "already-registered";
    throw e;
  }
  return "registered";
}

export function registerAll() {
  const tools = buildTools();
  installBridgeRegistry(tools);
  // Retry: document.modelContext can appear after hydration (flag/OT timing),
  // so a first-attempt "unsupported" must not be final.
  const backoff = [0, 500, 1500, 4000];
  let attempt = 0;
  const run = (): string => {
    const status = tryRegisterWebMCP(tools);
    // eslint-disable-next-line no-console
    console.info(`[webmcp] registration status: ${status}`);
    if (status === "unsupported" && attempt < backoff.length - 1) {
      setTimeout(run, backoff[++attempt]);
    }
    return status;
  };
  return run();
}
