# Zenith Earth Jukebox: how the sound works

NASA Space Apps 2026 asked for an "Earth Jukebox": an interface, script or application that pairs visual frames with dynamic sonifications generated in real time, that blind and low-vision users can use, that balances data interpretation with music that is pleasant to hear, and whose creative process is documented. This page is our answer, for the judges and for the team (Kshitij: see "Adding a mission" below).

## The idea in one paragraph

Zenith matches a Moon or Mars base to the place on Earth where it can be rehearsed. A percentage says how good the match is, but a number is easy to ignore and impossible to see for some people. So we turn the match into a **chord**. The base plays a chord in tune. The Earth site plays the same chord, but each note is detuned by how badly that part of the Earth site differs from the base. Two nearly equal notes make a slow wobble, the same wobble you hear when you tune a guitar. **A perfect match is a clean chord. A poor match beats and shimmers.** On top of that, each place plays a short melody that follows the shape of its ground, and the Earth voice takes its tone colour from a satellite picture of the site, so what you see and what you hear are paired.

Nothing is recorded or sampled. Every sound is made on the spot with the browser's built-in Web Audio API (no libraries), and the same input always gives the same sound.

## What you hear

* **Left and right.** The base sits a little to the left, the Earth site a little to the right. (Only a little: if each voice were in its own ear, headphones would stop the two chords from beating against each other.)
* **The chord.** Six soft notes, one per dimension, low to high: temperature, dryness, terrain, surface brightness, ground ice, sunlight. In tune on the base. On the Earth site, each is out of tune by `(1 - agreement) × 35 cents` (a cent is a hundredth of a semitone), alternately sharp and flat so the chord does not drift upward.
* **The key.** One key for both voices, so they are harmonised by construction. The base picks it: its id picks the root note, its body picks the scale (Moon: minor pentatonic, five open notes; Mars: Dorian, seven notes with a warmer, brighter sixth). Every melody note, bell and chord tone is in that key, so nothing ever sounds "wrong", only more or less in tune.
* **The melody.** A line through each place's terrain. Higher ground, higher note. Flat ground gives a near-drone, a steep crater rim gives wide leaps.
* **Bells.** If the ground holds ice, a high glassy bell rings. If only one place has ice, only one bell rings.
* **Reverb.** The better the match, the longer, warmer and fuller the room and the stronger the low root note under the chord. A poor match sounds thinner and drier.

## How it works

```
 site + target + match + frame stats        (frame = {hue, sat, light, cloud})
            |
            v
   js/sonify-core.js     pure mapping, no sound, runs in Node too
   profile(...)  ->  "sound profile": plain JSON (key, chord, detune cents, two melodies, bells, mix)
   describe(...) ->  the same thing in plain English
            |
            +--------------------------------+
            v                                v
   js/sonify.js  buildScene()         tools/sonify_render.mjs
   AudioContext, live player          OfflineAudioContext -> audio/*.wav + playlist.json
   (Listen button, crossfade)         (the SAME buildScene, driven by headless Chromium)
```

`buildScene(ctx, profile, t0)` only needs an audio context, so one engine serves both the live player and the offline files. They cannot drift apart.

### The terrain line (and why it is honest)

Each place gets a 12 km line of 64 points, built the same way as the 3D blocks in `js/ground.js` (fractal noise, seeded from the place's id, scaled so the average slope equals the measured `slope_deg`; `roughness_tri_m` sets how much fine detail there is; craters and lava-tube pits are added where the data records them; the height is never allowed to exceed the measured `relief_m`). **This is an illustration of measured statistics, not real elevation.** Two places with the same numbers get the same kind of line, but not a survey profile.

Both lines are turned into notes on **one shared height scale** (the taller of the two lines, but never less than 300 m), so the comparison is fair: a flat site next to a steep rim really does sound flat next to wide leaps. The 300 m floor stops two gentle places from each using the whole two octaves.

### Mapping table

| Data | What it changes in the sound | Range |
|---|---|---|
| Target id | Root note (one of 12), fixed by a hash, so each base always has its own key | 12 keys |
| Target body | Scale: Moon minor pentatonic, Mars Dorian | 2 scales |
| `dims.thermal` | Lowest chord tone (the root). Earth voice detune = (1 − value) × 35 cents | 0 to 35 cents |
| `dims.aridity` | Second chord tone, same detune rule | 0 to 35 cents |
| `dims.terrain` | Third chord tone, and also the Earth melody's tuning | 0 to 35 cents |
| `dims.surface` | Fourth chord tone | 0 to 35 cents |
| `dims.ice` | Fifth chord tone, and the Earth bell's tuning | 0 to 35 cents |
| `dims.illumination` | Top chord tone | 0 to 35 cents |
| Overall match | Reverb level 14 to 40 %, length 1.6 to 3.8 s, warmth (tail filter 6 kHz down to 1.8 kHz), root drone level 25 to 100 % | 0 to 1 |
| `slope_deg` (both places averaged) | One shared tempo, log scale from 0.1° to 15° | 60 to 110 bpm |
| Terrain line height, shared scale | Scale degree, spread over two octaves | 2 octaves |
| `roughness_tri_m` | Note density and chance of a one-step wobble in pitch, log scale 3 m to 1500 m | 25 to 95 %, 4 to 34 % |
| `albedo_wsa_unitless` | Brightness (low-pass filter 900 Hz up to about 5 kHz) and register (melody sits up to about a fourth higher on bright ground) | |
| `sun_noon_elev_mean_deg` | Low sun darkens the tone (filter × 0.45 at 0° rising to × 1 at 45° and above) | |
| `ground_ice_frac` | Bell level (none below 12 %), more often when ice is nearly everywhere | 0 to 1 |
| `temp_daynight_range_K` | The pad slowly breathes (a gentle filter sweep): the bigger the day-night swing, the deeper the breath | 0.07 to 0.13 Hz |
| Frame hue | Earth pad colour: warm hues (sand, rust) are richer, blue and green are purer, closer to a sine | |
| Frame saturation | Pad filter resonance and richness | |
| Frame lightness | Earth voice level (dark ocean quieter, bright ice louder) | 0.75 to 1.25 |
| Frame cloud fraction | Shimmer: a soft airy octave above the top tones, fluttering slowly | |

The base's own voice uses fixed grey (Moon) or rust (Mars) frame values, because we have no picture of the base to pair. A dimension that is missing from the data is treated as the overall match, and a missing feature falls back to a neutral value (slope 0.3°, roughness 20 m, albedo 0.2, no ice, sun 45°), so a half-filled target never crashes and never goes silent.

### The visual frame

For the Earth site the player cuts a window about 6° tall (roughly 650 km) out of NASA's Blue Marble image, shows it as a small thumbnail beside the Listen button (hidden from screen readers, with a slow scanning line that follows the melody, switched off for people who ask for reduced motion), and averages it to four numbers: hue, saturation, lightness and cloud fraction (clouds come from the matching cloud image). Those four numbers are a plain object `{hue, sat, light, cloud}`. The sound code never sees an image, so any picture source can be used later, and the Node tests need no images. If there is no image at all, a stand-in is made from the site's own albedo and rainfall.

## Accessibility

* **A text description that says the same thing as the sound**, in plain English, always visible and readable when nothing is playing, in a polite live region (`role="status"`). Example: *"Chile (Earth) beside Jezero crater (Mars). Match 86%, so the chord is mostly in tune; the least matched tone is temperature. Sloping, rugged ground gives a wide melody, like the base, at a steady pace. Mid-tone ground gives a soft, mellow tone. The satellite view around the Earth site is blue and clear, which shapes its voice."* The Listen button points at it with `aria-describedby`.
* **Sound only starts when the user presses Listen.** Never autoplay.
* A real `<button>` with `aria-pressed`, a labelled volume slider, visible focus rings, full keyboard use (Tab, Space, Enter, arrows on the slider). The app's own arrow-key shortcuts ignore the slider.
* Modest default volume, a master ceiling (the slider can never push the output past 0.9), and a limiter (a dynamics compressor) so no combination of data can be loud or harsh.
* 0.2 s fades in and out, so there are no clicks; changing the site crossfades to the new soundscape over 1.5 s, like a jukebox. Quick next, next, next presses settle on one sound.
* No flashing. The only motion is a slow scan line, switched off for `prefers-reduced-motion`.
* Sound stops by itself when the ground window is hidden or the user goes back to the home screen. The volume is remembered in the browser (if storage is allowed).
* Styled only with the app's CSS variables, so it follows every look (Classic, Frost, Night glass, Hologram), on a phone as well as a laptop.

## Adding a mission (for Kshitij)

Add the target to the data, nothing else.

1. Add the target in `tools/build_data.py` and rebuild `data/zenith-data.js` as usual. Give it an `id`, `name`, `body` (`"Moon"` or `"Mars"`) and `features`; give its candidates `dims`, `earth`, `lat` and `lon`. (Search words for the new base live in `js/mission.js`; that is about search, not sound.)
2. **In the app it has sound at once.** Searching for it, stepping through its sites and pressing Listen all work. The key is picked from its id, the melody from its slope, roughness and relief, and so on.
3. **For the offline files** run `node tools/sonify_render.mjs --all` (every target in the data, the seven examples first, then any target with no example mission) or `node tools/sonify_render.mjs --target <id>` (just that one; `playlist.json` keeps its other entries). A new target without an example mission gets the title "Moon base at …" or "Mars base at …" with the plan rover, habitat and science.
4. `node tools/test_sonify.mjs` should still pass.

We tested this with a made-up target added to the data only: it received a key, a melody, a description and a WAV with no other change.

## Rendering the audio files

```bash
npm i -g playwright && npx playwright install chromium     # once; only this tool needs it
node tools/sonify_render.mjs --all                         # audio/*.wav and audio/playlist.json
node tools/sonify_render.mjs --target jezero --site 2      # the 2nd best Earth site for one target
node tools/sonify_render.mjs --all --seconds 30 --out /tmp/jukebox
```

Options: `--target <id>`, `--all` (default), `--site <rank>` (1 is the best analog), `--seconds` (default 20), `--out` (default `audio/`), `--rate` (default 22050). A headless Chromium loads the app's own `js/sonify.js` and renders each soundscape on an `OfflineAudioContext`, so the files are made by exactly the code that plays live. They are mono, 16-bit, 22.05 kHz, 20 s, with a 0.2 s fade in and 1.5 s fade out, and each file is scaled to the same loudness (about −18 dBFS RMS, peak never above 0.89), so the playlist plays at an even level. The default set is about 6 MB. `audio/playlist.json` lists, for every track, the title, the mission text, the Earth site name and place, the match %, key and tempo, the file, the same plain-English description as the app, the frame numbers and their source, and a one-line "how to listen".

The seven default missions, best Earth analog of each:

| File | Base | Earth site | Match | Key and tempo |
|---|---|---|---|---|
| `polar-base.wav` | Shackleton crater rim (Moon) | Antarctica | 50% | G minor pentatonic, 84 bpm |
| `malapert-lander.wav` | Malapert Massif (Moon) | Pakistan | 58% | B minor pentatonic, 110 bpm |
| `lava-tube.wav` | Marius Hills lava-tube pit (Moon) | Near Yungay (Chile) | 64% | E minor pentatonic, 84 bpm |
| `arcadia-ice.wav` | Arcadia Planitia (Mars) | China | 60% | D Dorian, 74 bpm |
| `jezero-life.wav` | Jezero crater (Mars) | Chile | 86% | C Dorian, 90 bpm |
| `gale-climb.wav` | Gale crater (Mars) | China | 87% | G# Dorian, 98 bpm |
| `meridiani-trek.wav` | Meridiani Planum (Mars) | Egypt | 86% | B Dorian, 72 bpm |

Things worth listening for: `polar-base` has a flat Antarctic ice plain (almost a single held note) beside the steep, dark, wide-leaping crater rim, two bells because both places hold ice, and a visibly wobbling chord at 50%. `meridiani-trek` is the opposite: flat ground on both sides, a narrow slow melody, and a mostly steady chord.

## Wiring it into the app

Three lines (the parent app owns these files, so they are not edited here):

```html
<link rel="stylesheet" href="css/sonify.css">            <!-- after css/app.css -->
<script src="js/sonify-core.js"></script>                <!-- after js/ground.js -->
<script src="js/sonify.js"></script>                     <!-- before js/app.js -->
```
```js
// js/app.js, next to the ZenithGround.show call (r is the ranked entry)
if (window.ZenithSound) window.ZenithSound.update(s, t, { name: nameOf(s), place: placeOf(s), match: r.overall });
```

The player adds itself to the ground window (`#ground`), after its note. If that window is not there, it floats in the same corner. `ZenithSound.update(site, target, {name, place, match})` waits about a quarter of a second so rapid stepping settles, and returns a promise. `play()` and `stop()` are what the Listen button calls.

## Checks

`node tools/test_sonify.mjs` (plain Node, no browser, no packages) checks:

* same input gives the same profile and text;
* both voices, the chord, melody and bells share one root and scale, and the root comes from the target only;
* the base is always in tune, and the Earth voice is never more than 35 cents out;
* total detune falls as every dimension improves (210 to 158 to 105 to 53 to 0 cents for dims of 0, 0.25, 0.5, 0.75, 1) and each dimension on its own;
* ranges: 60 to 110 bpm, finite numbers, notes between MIDI 30 and 88, reverb and levels in bounds, across 287 real and example profiles;
* the mapping moves the right way (slope, roughness, albedo, low sun, ice, cloud, flat versus steep ground);
* odd or missing data (undefined, null, strings, NaN, Infinity, empty objects) never throws;
* the seven missions all sound different, a new target needs only data, frame statistics from raw pixels, and the description text;
* if `audio/` exists: length, format, peak, loudness, and that missions differ in the audio. The test prints each track's spectral centroid (383 Hz to 735 Hz for the seven defaults) and its strongest note, which in all seven was the key's root or fifth.

In a browser we also checked, on a copy of the app: nothing makes sound before Listen is pressed; pressing it starts a running audio context with no console errors; stepping to another site crossfades with no dropout; the volume slider silences and restores the output; Space and Enter work on the button; hiding the ground window stops the sound; a 390 px wide phone layout has no sideways scroll; and an offline render has non-zero RMS, peak below 1.0 and no NaN. We also measured the beating directly by rendering the chord alone: the power of the loudness wobble between 2 and 12 Hz rises steadily as the match falls (0.012 at a perfect match, 0.031 at 70%, 0.069 at 40%, 0.106 at 10%).

## Limits and honest notes

* **Earth imagery.** The brief points at NASA's Earth Information Center. Its imagery was **not reachable from our build environment** (our requests to NASA's Earth sites from the build machine all failed). We use NASA Visible Earth **Blue Marble** (day) and its cloud image instead, which were already in the app, as a stand-in. Because the sound only receives `{hue, sat, light, cloud}`, EIC frames can be swapped in later by changing where `frameFor` in `js/sonify.js` gets its pixels, with no change to the mapping. Blue Marble is a cloud-free yearly composite and shows land cover, not the conditions on any given day. A coastal site such as our Chile example gets some ocean in its window, which pulls it towards blue.
* **The terrain line is not elevation.** It is a statistical illustration (see above). The 3D blocks are too.
* **One shared tempo.** The two places play at the average of their slope tempos. Two independent tempos would drift apart and add a second kind of mismatch that no measured dimension stands for.
* **Geology is not voiced.** It is a category (it matches or it does not), not a smooth quantity, so there is no honest way to detune by it. Temperature is almost always the most detuned tone because Earth's coldest ground is still far warmer than every base (see the main README).
* **The numbers are design choices.** The 35 cents, the 300 m floor, the tempo and filter ranges were set by reasoning and by measuring the output (levels, spectra, beating depth, pitch range), not by a listening panel, and not by a trial with blind or low-vision users. We checked the output by measurement; please listen and adjust the constants at the top of each function in `js/sonify-core.js`. A proper user study is the obvious next step.
* **Small speakers.** Phone speakers do not reproduce the lowest notes (the root drone and the thermal tone). The beating is still audible in the mid tones; headphones are best.
* **Mono files.** The WAVs are mono, so they lose the left and right placement; the beating is unaffected.
* **Browser support.** Any browser with the Web Audio API and a user press (current Chrome, Edge, Firefox and Safari). Sound needs a press on Listen because browsers do not allow autoplay.

## Creative process

1. **Start from the physics of "close but not equal".** The brief wants data interpretation and pleasant music. Two notes that are nearly the same pitch beat against each other; the closer they are the slower the beat. That is a real, audible measure of difference that people already understand from tuning instruments, and it is pleasant when small and obviously "off" when large. So the match became tuning.
2. **One key, so it is always musical.** If both voices share one key and use only notes of that key, the data can never make an ugly clash. Detuning is the only thing that can. We chose a sparse minor pentatonic for the Moon (airy, empty, five notes) and Dorian for Mars (a little warmer, with the bright sixth on top) and let the base's id pick the root so each base has its own tonal identity.
3. **A chord with a story.** Six dimensions, six tones, low to high: temperature is the foundation, sunlight is the top. Ice is high and glassy because ice is. Cloud shimmers because clouds do.
4. **A melody from the ground.** Walking a line across each place's ground and letting height decide the pitch makes terrain audible: flat is a drone, rough is busy, steep is leaps. Both places use one height scale so you can hear which is rougher.
5. **Pairing sight and sound.** The Earth voice takes its colour from the satellite window beside the Listen button, so changing the picture changes the voice: hue sets the timbre, lightness the level, cloud the shimmer.
6. **Choices made along the way.**
   * The voices sit only a little left and right (±0.3), because with one voice per ear, headphones keep the two chords apart and the beating mostly disappears.
   * Our first draft had a 100 m floor on the shared height scale; measuring the result showed two gentle places each filling both octaves. 300 m keeps gentle ground narrow.
   * Our first melody register put notes as high as MIDI 95 and 96 (above 2 kHz) for steep ground, which is piercing. We lowered the centre by an octave and capped notes at MIDI 88.
   * Dark bases (the Moon, low sun) get a low filter, but the melody filter never goes below 900 Hz so the tune stays audible.
   * The better the match, the longer and warmer the reverb, so a good match feels spacious and a bad one thin.
7. **Words as well as sound.** The description is generated from the same profile as the sound, in short plain sentences, so someone who cannot hear it, or does not want to, gets the same information.

## Files

| Path | What |
|---|---|
| `js/sonify-core.js` | The mapping (no DOM, no audio; browser and Node) |
| `js/sonify.js` | The sound engine (live and offline) and the player UI |
| `css/sonify.css` | Player styling, from the app's CSS variables |
| `tools/sonify_render.mjs` | Renders `audio/*.wav` and `audio/playlist.json` (Playwright, used only here) |
| `tools/test_sonify.mjs` | Tests (plain Node) |
| `audio/` | The seven rendered tracks and `playlist.json` (about 6 MB) |

## Credits

* Earth imagery: **NASA Visible Earth, Blue Marble** (public domain).
* Sound: the W3C Web Audio API, built into the browser.
* Built with AI assistance (Claude), reviewed by Team Zenith.
