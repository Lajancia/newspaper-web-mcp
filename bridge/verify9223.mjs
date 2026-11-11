import WebSocket from "ws";
const ver = await (await fetch("http://127.0.0.1:9223/json/version")).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
let id = 0;
const send = (method, params) => new Promise((res, rej) => {
  const my = ++id;
  const to = setTimeout(() => rej(new Error("timeout " + method)), 6000);
  const on = (buf) => {
    const m = JSON.parse(buf.toString());
    if (m.id === my) { clearTimeout(to); ws.off("message", on); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  };
  ws.on("message", on);
  ws.send(JSON.stringify({ id: my, method, params }));
});
ws.on("open", async () => {
  const list = await (await fetch("http://127.0.0.1:9223/json/list")).json();
  const page = list.find(t => t.type === "page" && t.url.startsWith("http://localhost:3000"));
  const att = await send("Target.attachToTarget", { targetId: page.id, flatten: true });
  const sessionId = att.sessionId;
  console.log("sessionId:", sessionId);
  const ev = (expr) => { const my2 = ++id; ws.send(JSON.stringify({ sessionId, id: my2, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } })); return new Promise((res, rej) => { const to = setTimeout(() => rej(new Error("timeout")), 6000); const on = (buf) => { const m = JSON.parse(buf.toString()); if (m.id === my2) { clearTimeout(to); ws.off("message", on); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } }; ws.on("message", on); }); };
  console.log("HEADER:", (await ev('document.querySelector("header").textContent')).result.value);
  console.log("HEADLINE:", (await ev('document.querySelector("article a")?.textContent')).result.value);
  ws.close(); process.exit(0);
});
setTimeout(() => { console.error("global timeout"); process.exit(1); }, 9000);
