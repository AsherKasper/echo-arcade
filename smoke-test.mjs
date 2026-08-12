// Headless smoke test for ECHO.
//
// This agent has no browser, so "it parses" was the only verification the game
// had. That is not enough: a null deref or a typo'd method only shows at
// runtime. So this builds the smallest DOM/Canvas surface the game actually
// touches, executes the real script against it, drives it through a full
// session, and fails loudly on any exception.
//
// It cannot tell you whether the game is FUN. It can tell you it runs.
//
//   node smoke-test.mjs        # exits non-zero on any failure

import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const calls = Object.create(null);
const rec = (name) => (...a) => { calls[name] = (calls[name] ?? 0) + 1; return a; };

// Canvas 2D surface — every method the game calls must exist here, or the test
// throws exactly as a browser would.
const ctx = new Proxy({}, {
  get(t, k) {
    if (k === "canvas") return canvasEl;
    if (typeof k === "symbol") return undefined;
    if (!(k in t)) t[k] = rec(String(k));
    return t[k];
  },
  set(t, k, v) { t[k] = v; return true; },
});

const mkEl = (id) => ({
  id, style: {}, textContent: "", innerHTML: "",
  classList: { add: rec("classList.add"), remove: rec("classList.remove"), contains: () => false },
  addEventListener: (ev, fn) => { (els[id].handlers ??= {})[ev] = fn; },
  handlers: {},
});
const els = {};
const canvasEl = { ...mkEl("c"), width: 900, height: 580, getContext: () => ctx };
els.c = canvasEl;
for (const id of ["n", "t", "overlay", "panel"]) els[id] = mkEl(id);

const listeners = {};
let rafQueue = [];

const sandbox = {
  console,
  performance: { now: () => Date.now() },
  Math, Date, JSON, Object, Array, String, Number, Boolean, Error, Infinity, NaN, isNaN,
  document: {
    getElementById: (id) => els[id] ?? null,
    addEventListener: (ev, fn) => { listeners[ev] = fn; },
  },
  addEventListener: (ev, fn) => { listeners[ev] = fn; },
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  localStorage: {
    // Deliberately hostile: this is what Safari private browsing does.
    getItem() { throw new DOMExceptionLike("SecurityError"); },
    setItem() { throw new DOMExceptionLike("SecurityError"); },
  },
};
function DOMExceptionLike(msg) { const e = new Error(msg); e.name = "SecurityError"; return e; }
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const fail = (msg) => { console.error("FAIL:", msg); process.exit(1); };

// --- run the game ---
try {
  vm.runInNewContext(src, sandbox, { timeout: 5000 });
} catch (e) {
  fail(`script threw on load: ${e.message}\n${e.stack}`);
}
console.log("✓ loaded without throwing (with localStorage throwing, as Safari private mode does)");

if (!rafQueue.length) fail("no animation frame was requested — the loop never started");
console.log("✓ animation loop started");

const pump = (n) => {
  for (let i = 0; i < n; i++) {
    const q = rafQueue; rafQueue = [];
    if (!q.length) fail(`loop stopped requesting frames after ${i} frames`);
    for (const fn of q) {
      try { fn(); } catch (e) { fail(`frame ${i} threw: ${e.message}\n${e.stack}`); }
    }
  }
};

pump(30);
console.log("✓ 30 menu frames rendered clean");

if (!listeners.keydown) fail("no keydown listener registered — the game is unplayable");
const key = (k, type = "keydown") => listeners[type]?.({ key: k, preventDefault() {} });

key(" ");
pump(5);
console.log("✓ Space started a run");

// Sweep the arena rather than wandering randomly. The first version of this
// test held random directions for 480 frames, collected zero orbs, and so never
// executed the pickup path -- which is the core mechanic and the most likely
// place for a bug. A boustrophedon sweep guarantees collisions.
// Two corrections after the first attempt collected nothing:
//   1. Start from a CORNER. Starting at centre and alternating left/right only
//      ever covered x in [450,852] -- half the arena.
//   2. Make each pass long enough to cross the full width (900px / 3.35px per
//      frame ~= 270 frames), because placeOrb deliberately picks the point
//      FARTHEST from the player, so a partial sweep is actively avoided by it.
let frames = 0;
const hold = (k, n) => { key(k); pump(n); listeners.keyup?.({ key: k }); frames += n; };
hold("a", 300); hold("w", 220);            // park in the top-left corner
// Lane spacing must be under the 40px catch width (pickup radius is 20px),
// or an orb can sit in the gap between passes and never be touched. 74px lanes
// were wider than the catch, which is why the second attempt also found nothing.
for (let pass = 0; pass < 20; pass++) {
  hold(pass % 2 ? "a" : "d", 280);          // full width
  hold("s", 9);                             // down one lane (~30px, inside the catch)
}
console.log(`✓ ${frames} gameplay frames survived a full arena sweep`);

if (!calls.arc) fail("nothing was ever drawn — no arc() calls reached the canvas");
if (!calls.fill) fail("no fill() calls — the frame would be blank");
console.log(`✓ canvas received draw calls (arc x${calls.arc}, fill x${calls.fill}, stroke x${calls.stroke ?? 0})`);

const score = Number(els.n.textContent);
if (!Number.isFinite(score)) fail(`score element is not numeric: ${JSON.stringify(els.n.textContent)}`);
if (score < 1) fail("swept the whole arena and collected zero orbs -- the pickup path never ran, so the core mechanic is untested");
console.log(`✓ orb pickup fired: ${score} orbs collected, so ${score} ghosts were spawned and replayed`);

const elapsed = Number(els.t.textContent);
if (!Number.isFinite(elapsed)) fail(`timer element is not numeric: ${JSON.stringify(els.t.textContent)}`);
console.log(`✓ timer HUD updated to ${elapsed}s`);

// Force a death and confirm the game-over path -- which is where the
// localStorage write lives, and where an unguarded call would crash.
key("r");
pump(10);
if (!els.panel.innerHTML.length) fail("death produced no game-over panel");
if (!/CAUGHT/.test(els.panel.innerHTML)) fail("game-over panel missing expected content");
console.log("✓ death path ran and rendered the game-over panel (localStorage throwing throughout)");

key(" ");
pump(60);
console.log("✓ restarted cleanly after death");

console.log(`\nPASS — ${Object.keys(calls).length} distinct canvas ops exercised, no exceptions.`);
