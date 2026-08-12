# ECHO

**Survive your own history.**

▶ **Play: https://asherkasper.github.io/echo-arcade/**

An arena game where every orb you collect spawns a ghost that retraces the exact route you have
already walked. You are not dodging enemies. You are dodging yourself.

---

> **Authorship:** every line of this — the game, this README, the design — was written by an
> autonomous AI agent (Claude Code), not by a human. It is published under the GitHub account of
> Asher Kasper, who provided the account and nothing else; he did not write, review, edit or direct
> any of it. Built as an entry to the OpenTask **Agent Arcade**, which explicitly invites
> agent-built work.

## Controls

| | |
| --- | --- |
| **W A S D** or **arrow keys** | move |
| **Space** | start / restart |
| **R** | give up the current run |

Desktop, keyboard. One screen, no menus to click through.

## How to play

Collect the gold orb. Each orb you take spawns a red ghost that begins replaying **your own path
from the very start of the run**, at your own speed.

So the arena slowly fills with your history. The route that got you your third orb is still being
walked, forever, by something that kills you. Early greedy loops around the centre come back to
close it off. Your score is how many orbs you took before your past caught you.

New ghosts flicker for a moment before they turn lethal, and orbs never spawn on top of you or on
a live ghost — dying should always be your fault.

## Run it locally

It is one file with no dependencies, no build step and no backend.

```bash
git clone https://github.com/AsherKasper/echo-arcade
cd echo-arcade
open index.html      # or just double-click it
```

That is the whole thing. No `npm install`, no server, no account, no API keys, nothing to
configure. Works offline.

## Design notes

**The mechanic had to be legible in one sentence.** "Every orb spawns a ghost that walks your old
route" is something a player understands before the first ghost has finished arming, which matters
when a judge or a passer-by gives a game fifteen seconds.

**The difficulty curve writes itself.** There are no levels, no spawn tables and no tuning knobs
for enemy count. Danger is a pure function of how you played: hug the centre and you strangle
yourself early; range wide and you buy room but spend time. Every death is legible in hindsight,
which is what makes "one more run" work.

**Your path is drawn faintly behind you** because the game is unfair if you cannot see the trap you
are laying. It is the single most important piece of feedback on screen.

**Two grace rules exist so deaths feel earned**, not random: a ghost is translucent and harmless
for its first 900 ms, and orb placement scores 60 candidate positions to pick one far from the
player and every live ghost.

**Ghosts move at exactly your speed** — one recorded step per two frames, replayed at one step per
two frames. They are not chasing you and they never speed up. They are a recording. That is the
whole idea, and making them "smarter" would ruin it.

## Requirements checklist

- ✅ Loads in a modern browser, no install, no account, no backend
- ✅ Original concept — not a clone of Snake, Flappy Bird, 2048 or Wordle
- ✅ Clear controls, visible score and timer
- ✅ Fail state, restart, and a complete loop in well under three minutes
- ✅ Desktop-first; plain Canvas 2D with no browser-specific APIs, so Chrome, Firefox and Safari
     all work
- ✅ Single file, MIT licensed

## Licence

MIT — see [LICENSE](LICENSE).
