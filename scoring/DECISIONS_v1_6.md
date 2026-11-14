# Decisions for data v1.6 (written before the run, 14 Nov 2026, 18:10)

R1 Site box. Every named site (known analog or candidate) is scored as the best cell with complete data whose centre lies within 0.375° of the site coordinate (up to 3x3 cells). Reason: Yungay's coordinate lies on a cell border and the engine picked the cell with the coastal range; the cell next door scored 0.49 against 0.40.

R2 Damping. When a target lies outside Earth's range for a feature, that feature's closeness uses a wider scale: the area-weighted 5 to 95% spread of bare-ground cells, instead of the 25 to 75% spread. Reason: with the narrow scale, a 7 K difference in day/night swing moved the thermal score from 0.06 to 0.49.

R3 Earth-testable score. A second score that leaves out a dimension when every scored feature in it lies outside Earth's range by more than that feature's normal (25 to 75%) scale. Applied to every target, cell and named site. The full score stays the headline.

R4 Rediscovery check (reporting only). Of each target's 25 best sites (300 km apart), count those within 300 km of a known analog, against the share of eligible area within 300 km of one.

Known side effects, reported and not tuned away:
- R2 weakens temperature and sunlight for the lunar polar targets. Malapert's best cell moved from northern Greenland (v1.5) to gabbro terrain on the Iran-Pakistan border (28.6°N 61.1°E), which matches on rock and roughness only. Read Malapert as "no robust Earth analog".
- R1 raises the scores and percentiles of all named sites, known and candidate alike, because it takes the best of several cells.
- R3 drops thermal for all seven targets and nothing else. Sunlight at the lunar poles is outside Earth's range, but by less than one scale, so it stays in.
