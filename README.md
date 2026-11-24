# Solmar Bay — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/belalharlos357-bot/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/belalharlos357-bot/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** is a complete open-world crime game in the spirit of GTA 6, built for the [make.fun bounty](https://make.fun/bounty/gta6-01). It plays entirely offline in a desktop browser from static files — no network requests, no build step.

You are **Mara Voss**, getaway driver, back in the sun-soaked coastal city that burned you. The crew needs one last job done: five missions across Solmar Bay, with the whole Solmar PD standing between you and the payout.

## What is in the game

- **A city on foot and by car** — a procedural coastal city (9×9 street grid, downtown towers, beachfront hotels, a pier and docks), explored third-person on foot or behind the wheel.
- **Traffic and pedestrians** — cars cruise the grid and turn at intersections; walkers stroll the sidewalks, scatter from speeding cars and go down when hit.
- **Cars to steal** — walk up to any parked or traffic car and press **E** to take it. Stealing is a crime.
- **Wanted system and police** — crimes raise your heat (1–5 stars); Solmar PD cars spawn, chase and ram you. Lose them, get busted on foot, or get wasted at zero health.
- **Missions and a story** — "The Solmar Job": five missions (steal wheels, a dockside pickup, a police escape, a 90-second timed delivery, a penthouse holdout), with a glowing beacon, HUD objective text, distance and timers, and cash payouts.
- **Combat** — a pistol on foot (click to shoot, with tracer), car ramming, and police cars you can disable.
- **HUD with minimap** — cash, mission objective, wanted stars, health, speed, and a live circular minimap showing roads, buildings, traffic, police and the mission beacon.
- **Start and save** — title screen, pause menu, and automatic saving to localStorage (cash, mission progress, position).
- **Polish** — late-afternoon sun with shadows, palm-lined avenues, billboards, synthesized WebAudio sound (engine, sirens, gunshots, mission jingles) — no audio assets.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Shift | Sprint |
| E | Get in / out of a car |
| Mouse drag | Orbit camera · wheel zooms |
| Click | Shoot (on foot) |
| Space | Handbrake |
| C | Camera distance |
| M | Mute |
| Enter | Start the story |
| Esc | Pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` from any static file server. `main.ts` (Node 22) hands the game in to make.fun, copying `game/` and `screenshots/` and writing `dossier.json`.

## Structure

- `game/src/main.js` — orchestration, camera, driving physics, collisions, save/load
- `game/src/city.js` — procedural city, ground map, buildings, palms, lamps, billboards
- `game/src/vehicles.js` — car meshes, traffic AI, police chase AI
- `game/src/pedestrians.js` — sidewalk walkers
- `game/src/player.js` — Mara Voss, on-foot movement and shooting
- `game/src/missions.js` — "The Solmar Job" mission chain
- `game/src/wanted.js` — heat, stars, police spawning, busted/wasted
- `game/src/hud.js` — HUD panels and the live minimap
- `game/src/shots.js` — staged screenshot scenes (`?shot=cover|street|chase|title`)
- `game/src/audio.js` — synthesised WebAudio sound effects
- `game/vendor/three.min.js` — three.js r186 (MIT), vendored

Everything in the game — city, characters, vehicles, names, story, art and sound — is original. Nothing from Rockstar Games or any other commercial game.

## License

MIT — see `LICENSE`. three.js is MIT (see `game/vendor/THREE-LICENSE`).
