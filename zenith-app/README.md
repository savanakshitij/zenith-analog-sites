# Zenith web app

Team Zenith, NASA Space Apps 2026: *Identify Earth locations that analog the permanent Moon base locations and Mars.*

Type a Moon or Mars mission. Zenith scores every patch of bare ground on Earth against the place the mission is going and flies to the best test sites.

**Run it:** open `index.html` in a browser. No server, no build step. Scoring, the globe and the 3D ground view work offline. Satellite and Moon/Mars photos and the web fonts need internet; without it the photos hide and system fonts are used.

## What is on screen

- **Search.** Suggestions are 9 real upcoming missions (status checked 14 Nov 2026, with sources) and 7 example missions. Free text works too: keyword rules pick the target and the mission parts. Text that names no Moon or Mars place or mission part gets a message, not a guess.
- **Two answers.** Every search gives the best match overall and the best new candidate: the best cell at least 500 km from every known analog site. A best match inside 500 km is labelled a known analog region.
- **Drill game** (`game/index.html`, button on the home page). One mission, Jezero: the player compares two real places (Atacama and Iceland) in plain facts, picks one and taps to drill for 8 seconds. Metres per tap come from the engine score of the place picked, so only the better place can reach the 30 m finish. A ranking board (kept in that browser) closes the game. Works on phones.
- **Home page QR.** When the app is on a web address, the home page shows a QR code of that address, so visitors can tour it or play the game on their phone.
- **Simulate ("Turn Earth into Mars").** For presenting live. Pick a target, then add its conditions one at a time (or let the room pick, or press Play). A place stays in only while its closeness is 0.5 or more on every condition switched on, so the count only goes down. A condition past anything on Earth (cold, for all seven targets) lets nothing through. The globe paints the survivors and flies to the best one. Space or the right arrow adds the next condition.
- **Your conditions.** Sliders and number boxes for latitude (Sun height), coldest temperature, day–night swing, slope, ruggedness, brightness, rain, ground ice and rock type. Each can be switched off. It builds a custom target with the same v1.6 rules and scores all of Earth live. Values past Earth's range are marked, and a weak best score is reported as no close match.
- **Result.** The camera flies to the best site. The panel shows the match score (0 to 1, a geometric mean over seven dimensions), where the cell ranks among all scored cells, how far the nearest known analog site is, and whether the rank is stable under 200 random weightings.
- **Seven fact cards.** Overview (real-mission note, match quality, the two answers, the seven dimensions, photos, field-test coverage, editable plan), Matches, Gaps (including what Earth can never test), Season, Hazards, Studies, Also fits.
- **Click any land** to score that cell for the current mission.
- **Score layer** colours every scored cell. **Known sites** flags the analog sites agencies already use.
- **Case studies and Evidence** in the top bar. Evidence shows the rediscovery check (24 hits against 10.2 expected by chance). **On your phone** appears when the page is served from a web address: it shows a QR code of that address, made in the browser.
- **Ground comparison.** Two 3D blocks built from each place's measured slope, ruggedness and brightness. Illustrations of the numbers, not survey maps.
- **Design button.** Panel looks, fonts and the film effect. Settings stay in the viewer's browser.

## Where the numbers come from

Every score is computed live in the browser by `js/zenith-engine.js`, the same formula as `scoring/score_v16.py` (data v1.6, checked to within 0.0003 of the Python output).

- **Match score.** All seven dimensions always count with weight 1. Each mission part selected adds weight to the dimensions it depends on (`PARTS` in `js/bridge.js`). No dimension is ever dropped, so a part cannot hide a bad match. Real missions carry their own weights from `missions/missions.json`.
- **Field-test coverage.** Dimension match times the ceiling from the team's mission-plan layer (`js/coverage.js`). It is coverage, not similarity, and is shown separately from the score.
- **Match quality.** Strong from 0.70, moderate from 0.50, weak below. Moon polar missions come out weak or moderate because no place on Earth is that cold. The app says so.

## Files

| Path | What |
|---|---|
| `index.html`, `css/app.css`, `css/fonts.css` | Page and styles |
| `js/zenith-engine.js` | The team's v1.6 scoring engine (same file as `app/map/`) |
| `js/coverage.js` | The team's mission-plan layer (same file as `app/`) |
| `js/bridge.js` | Connects the page to both: ranking, per-cell records, coverage, new candidates, custom conditions |
| `js/app.js` | UI |
| `js/simulate.js` | The Simulate mode |
| `js/mission.js` | Plain words to a plan, the real missions and the examples |
| `js/features.js` | Season, hazards |
| `js/globe.js` | WebGL Earth, markers, camera flights, score layer |
| `js/ground.js`, `js/design.js` | 3D ground comparison, Design button |
| `js/vendor/` | d3 7.9.0, topojson-client 3.1.0, three.js r128, qrcode-generator 1.4.4 (MIT), country outlines |
| `data/engine-data.js` | v1.6 engine data, embedded so the page opens from a file (11 MB) |
| `data/extras.js` | Monthly climate, wind, dust and stability per cell, studies, known sites, target notes |
| `data/missions.js` | Copy of `missions/missions.json` |
| `cases/` | The two written case studies |
| `tools/build_app_data.py`, `tools/stability.js` | Rebuild the data files |

## Limits

- Scores compare climate, terrain, surface, ice, sunlight and rock type on a 0.25° grid. There is no soil chemistry layer.
- Access, permits and cost are not scored. Nobody on the team has visited these sites.
- Mission-part weights and coverage ceilings are team assumptions.
- Unnamed cells are labelled by country.
- Rosalind Franklin and Tianwen-3 do not land on one of our seven targets, so they use the closest one. The app flags this.

Built with AI assistance (Claude), reviewed by Team Zenith.
