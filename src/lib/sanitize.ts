/**
 * Security: tool arguments are untrusted input from agents.
 * Only http(s) URLs are allowed — blocks javascript:, data:, and other
 * executable schemes from being injected through add_headline/add_story.
 */
export function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* not a valid absolute URL */
  }
  return undefined;
}

/** Collapse agent-supplied free text to a bounded, single-line-safe string. */
export function safeText(text: string | undefined, max = 500): string {
  if (!text) return "";
  // strip control characters (incl. newlines in titles/sources), cap length
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
