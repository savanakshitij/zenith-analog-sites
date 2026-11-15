// Shared ranking board for the drill game (game/index.html).
// Storage: Vercel Blob. Each score is its own tiny blob and the score lives in the blob's name,
// so saving never overwrites anyone else's entry and reading is one list call (no read-modify-write races).
//   GET  /api/scores          -> { total, top: [{ id, name, m, s, at }] }   (best 50)
//   POST /api/scores {name, m, s} -> { id, place, total, top }
const { put, list } = require("@vercel/blob");

const PREFIX = "drill-v1/";
const GOAL = 30, SECS = 8;            // same rules as the game: 30 m finish line, 8 seconds
const MIN_FINISH = 2.5;               // fastest humanly possible 30 m (about 12 taps a second at the best site)
const TOP = 50, NAME_MAX = 18;
const BAD = /(fuck|shit|cunt|nigg|fag|bitch|whore|rape|nazi|hitler|porn|dick|penis|vagina|slut)/i;

const hits = new Map();               // per-instance rate limit: ip -> [timestamps]
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 30;             // at most 30 saves a minute from one address (a venue Wi-Fi shares one address)
}

function cleanName(raw) {
  if (typeof raw !== "string") return null;
  let n = raw.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯<>{}\\`"]/g, "").replace(/\s+/g, " ").trim();
  n = Array.from(n).slice(0, NAME_MAX).join("");
  if (!n || !/[\p{L}\p{N}]/u.test(n)) return null;
  if (BAD.test(n.replace(/[^\p{L}]/gu, ""))) return null;
  return n;
}

const b64 = s => Buffer.from(s, "utf8").toString("base64url");
const unb64 = s => Buffer.from(s, "base64url").toString("utf8");
const rankSort = (x, y) => (y.m - x.m) || ((x.s || 99) - (y.s || 99)) || (x.at - y.at);

// name format: drill-v1/<depth*10>_<secs*100 or 0>_<time>_<rand>_<base64url name>.txt
function parse(pathname) {
  const m = pathname.slice(PREFIX.length).replace(/\.txt$/, "").match(/^(\d{1,3})_(\d{1,4})_(\d{13})_([a-z0-9]{6})_([A-Za-z0-9_-]{1,120})$/);
  if (!m) return null;
  try {
    const name = unb64(m[5]);
    return { id: `${m[3]}_${m[4]}`, name, m: +m[1] / 10, s: +m[2] ? +m[2] / 100 : null, at: +m[3] };
  } catch (e) { return null; }
}

async function all() {
  const out = []; let cursor;
  for (let page = 0; page < 10; page++) {         // up to 10,000 entries, plenty for one event
    const r = await list({ prefix: PREFIX, cursor, limit: 1000 });
    r.blobs.forEach(b => { const e = parse(b.pathname); if (e && !/^zzz-check/i.test(e.name)) out.push(e); });   // zzz-check = deploy self-test, hidden
    if (!r.hasMore) break; cursor = r.cursor;
  }
  return out.sort(rankSort);
}

function send(res, code, body, cache) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 2000) throw new Error("too big"); }
  return JSON.parse(raw || "{}");
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const rows = await all();
      return send(res, 200, { total: rows.length, top: rows.slice(0, TOP) }, "public, s-maxage=3, stale-while-revalidate=10");
    }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "Use GET or POST." }); }

    const origin = req.headers.origin, host = req.headers["x-forwarded-host"] || req.headers.host;
    if (origin && host && new URL(origin).host !== host) return send(res, 403, { error: "Scores can only be saved from the game." });
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
    if (limited(ip)) return send(res, 429, { error: "Too many scores from here. Wait a minute." });

    let body; try { body = await readBody(req); } catch (e) { return send(res, 400, { error: "Bad request." }); }
    const name = cleanName(body.name);
    if (!name) return send(res, 400, { error: "Pick a different name (letters or numbers, up to 18)." });
    const m = Number(body.m), s = body.s == null ? null : Number(body.s);
    if (!Number.isFinite(m) || m < 0 || m > GOAL) return send(res, 400, { error: "That depth is not possible." });
    if (s !== null && (!Number.isFinite(s) || s < MIN_FINISH || s > SECS || m < GOAL)) return send(res, 400, { error: "That time is not possible." });

    const at = Date.now(), rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
    const d10 = Math.round(m * 10), s100 = s ? Math.round(s * 100) : 0;
    await put(`${PREFIX}${d10}_${s100}_${at}_${rand}_${b64(name)}.txt`, "1", { access: "public", addRandomSuffix: false, contentType: "text/plain" });

    const me = { id: `${at}_${rand}`, name, m: d10 / 10, s: s100 ? s100 / 100 : null, at };
    const rows = await all();
    if (/^zzz-check/i.test(name)) return send(res, 201, { id: me.id, place: 0, total: rows.length, top: rows.slice(0, TOP), check: true });
    if (!rows.some(r => r.id === me.id)) rows.push(me), rows.sort(rankSort);  // list can lag a moment behind put
    return send(res, 201, { id: me.id, place: rows.findIndex(r => r.id === me.id) + 1, total: rows.length, top: rows.slice(0, TOP) });
  } catch (e) {
    console.error("scores", e);
    return send(res, 500, { error: "The ranking board is offline." });
  }
};
