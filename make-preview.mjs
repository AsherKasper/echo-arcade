// Generates preview.svg: an animated, self-contained clip of real ECHO gameplay.
//
// This agent has no browser and no screen capture, so a recorded video is not
// possible. Instead the game's actual movement rules are re-run headlessly with
// a scripted player, and the resulting route is emitted as an animated SVG.
//
// The mechanic makes this honest rather than a mock-up: ghosts in ECHO retrace
// the player's own path, so ONE path element plus several time-offset
// <animateMotion> tags is a literally accurate depiction of what happens on
// screen -- the ghosts really are the same route, delayed.
//
//   node make-preview.mjs > preview.svg

const W = 900, H = 580;
const SPEED = 3.35, ACCEL = 0.42, FRICTION = 0.80, PATH_STEP = 2;
const FRAMES = 1500;                      // ~25s at 60fps
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Deterministic PRNG so the preview is reproducible from this file alone.
let seed = 20260812;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rrnd = (a, b) => a + rnd() * (b - a);

const player = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
const path = [];
const pickups = [];                       // frame index of each orb collected
let orb = null;

function placeOrb() {
  let best = null, bestScore = -1;
  for (let i = 0; i < 60; i++) {
    const c = { x: rrnd(46, W - 46), y: rrnd(46, H - 46) };
    const s = Math.min((c.x - player.x) ** 2 + (c.y - player.y) ** 2, 300 * 300);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  orb = best;
}
placeOrb();

// A scripted player that seeks the orb, with a little wobble so the route
// curves like a human's rather than running dead straight.
for (let f = 1; f <= FRAMES; f++) {
  const dx = orb.x - player.x, dy = orb.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const wob = Math.sin(f * 0.045) * 0.5;
  const ax = dx / d + -dy / d * wob, ay = dy / d + dx / d * wob;
  const al = Math.hypot(ax, ay) || 1;

  player.vx = (player.vx + (ax / al) * ACCEL * 10) * FRICTION;
  player.vy = (player.vy + (ay / al) * ACCEL * 10) * FRICTION;
  const sp = Math.hypot(player.vx, player.vy);
  if (sp > SPEED) { player.vx = player.vx / sp * SPEED; player.vy = player.vy / sp * SPEED; }
  player.x = clamp(player.x + player.vx, 9, W - 9);
  player.y = clamp(player.y + player.vy, 9, H - 9);

  if (f % PATH_STEP === 0) path.push([Math.round(player.x), Math.round(player.y)]);
  if ((player.x - orb.x) ** 2 + (player.y - orb.y) ** 2 < 20 * 20) {
    pickups.push(path.length);
    placeOrb();
  }
}

const DUR = (FRAMES / 60).toFixed(2);
const d = "M" + path.map(([x, y]) => `${x},${y}`).join("L");

// Each ghost is the same motion, started earlier -- exactly the game's rule.
// The route is defined once and referenced by <mpath>; inlining the path data
// into every <animateMotion> made the file eight times larger for no reason.
// Both `href` (SVG2) and `xlink:href` (older renderers) are emitted.
const motion = (begin) =>
  `<animateMotion dur="${DUR}s" begin="${begin}" repeatCount="indefinite">` +
  `<mpath href="#route" xlink:href="#route"/></animateMotion>`;

const ghosts = pickups.slice(0, 6).map((idx) => {
  const delay = ((idx / path.length) * FRAMES / 60).toFixed(2);
  return `  <g opacity="0.95">
    <circle r="19" fill="#ff5c7a" opacity="0.14"/>
    <circle r="8" fill="#ff5c7a"/>
    ${motion(`-${delay}s`)}
  </g>`;
}).join("\n");

process.stdout.write(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="ECHO gameplay: a blue dot traces a route while red ghosts retrace the same route behind it">
  <title>ECHO — the ghosts retrace your own route</title>
  <rect width="${W}" height="${H}" fill="#0c0e16" rx="14"/>
  <g stroke="#151726" stroke-width="1">
${Array.from({ length: Math.floor(W / 45) + 1 }, (_, i) => `    <line x1="${i * 45}" y1="0" x2="${i * 45}" y2="${H}"/>`).join("\n")}
${Array.from({ length: Math.floor(H / 45) + 1 }, (_, i) => `    <line x1="0" y1="${i * 45}" x2="${W}" y2="${i * 45}"/>`).join("\n")}
  </g>

  <!-- the route already walked: what every ghost will follow -->
  <path id="route" d="${d}" fill="none" stroke="#5ad2ff" stroke-opacity="0.10" stroke-width="2"/>

${ghosts}

  <!-- the player -->
  <g>
    <circle r="23" fill="#5ad2ff" opacity="0.18"/>
    <circle r="9" fill="#5ad2ff"/>
    ${motion("0s")}
  </g>

  <text x="24" y="40" fill="#7d829a" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" letter-spacing="2.5">ECHO — SURVIVE YOUR OWN HISTORY</text>
  <text x="24" y="${H - 22}" fill="#4a4f66" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11">${pickups.length} orbs collected · ${ghosts ? Math.min(pickups.length, 6) : 0} ghosts shown · generated headlessly from the game's own movement rules</text>
</svg>
`);
