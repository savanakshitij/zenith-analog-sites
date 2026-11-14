# Patch 2 (Mars temperatures) and patch 4 (Moon temperatures)

| target | temp_min_K | temp_daynight_range_K | old values | type |
|---|---|---|---|---|
| arcadia | 163.0 | 75.6 | 150 / 60 (estimated) | model (MCD v6.2) |
| jezero | 190.6 | 76.9 | 200 / 60 (rover, one season) | model (MCD v6.2) |
| gale | 183.9 | 83.1 | 190 / 60 (rover, one season) | model (MCD v6.2) |
| meridiani | 187.4 | 89.1 | 190 / 60 (assumed = Gale) | model (MCD v6.2) |
| shackleton | 55.6 | 44.9 | 150 / 70 (estimated) | measured (Diviner) |
| malapert | 68.4 | 99.4 | 150 / 70 (estimated) | measured (Diviner) |

## Mars (mars_temps.csv)
Mars Climate Database v6.2 web interface, climatology dust scenario. Surface temperature at 02:00 and 14:00 local time for Ls 0 to 330 in 30 degree steps. temp_min = coldest 02:00 value, range = mean of (14:00 minus 02:00). Raw 96 values: zenith_raw/MCD_v6.2/mcd_tsurf_raw.tsv. This is a climate model, not a measurement; it agrees with the rover values at Jezero and Gale to within about 10 K.

## Moon (moon_temps.csv)
Diviner Polar Cumulative Products (Williams et al. 2019), read directly from the PDS files. Mean bolometric temperature over the 28 x 28 km box, in 8 local-time bins, summer and winter.

Read this before using the Moon numbers:
- They are 28 km BOX MEANS, the same definition as the Earth cells. The box around the Shackleton rim is mostly permanently shadowed crater floor (pixels down to 36 K), so the mean is far colder than the sunlit rim itself. Single sunlit pixels in the same box reach 200-300 K.
- The old 150 / 70 values described the sunlit rim. If the team wants "rim only", keep those and label them estimates. Do not mix the two definitions.
- Sampling is coarse: 8 of 96 local-time bins, 5 columns across the box. One Malapert summer bin had no data and one had too few pixels; both were dropped. Treat the values as +/- 15 K.
- "Day/night" at the pole is really the monthly sweep of the Sun around the horizon; the seasonal difference is as large (Shackleton summer swing 71 K, winter 18 K).

Effect on scoring: none on rankings. Every target stays colder than any Earth cell (coldest Earth cell 194 K), so thermal remains clamped.
