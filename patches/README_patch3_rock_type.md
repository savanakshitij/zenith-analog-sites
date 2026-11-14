# Patch 3: rock type and impact craters (other sources, not NASA)

| File | Columns |
|---|---|
| rock_GLiM.csv | cell_lat, cell_lon, rock_class (GLiM code 1-16), rock_abbr, basalt_flag (vb), mafic_flag (vb or pb), volcanic_flag (vb, va, vi, py), impact_crater (name of confirmed crater in the cell), impact_diameter_km |
| rock_classes.csv | code, abbreviation, name |
| impact_craters.csv | name, lat, lon, diameter_km, coord_source (199 confirmed structures) |
| targets_rock_PROPOSED.csv | suggested rock class per Moon/Mars target. PROPOSAL from general literature, Mo should review |

Same 349,031 land cells as the Earth layers.

## How this fixes the validation failures
12 of the 15 failures were rock-type analogs that sit in vegetated cells. Checked at the known sites:
- Impact sites: 6 of 6 now carry a crater flag (Haughton, Mistastin, Sudbury, Meteor Crater, Ries, Lonar).
- Basalt sites: HI-SEAS, Craters of the Moon, Holuhraun and Teide are vb; Mauna Kea is vi (caught by volcanic_flag). Missed: Lanzarote (cell is ocean at 0.5 deg) and Black Point (flow smaller than the cell).
- Not fixed: Rio Tinto and Pilbara (geochemistry and age, not rock class).

Suggested use (Kshitij): add a sixth/seventh dimension "geology" = 1 if the cell's rock_abbr matches the target (or impact_crater is set and the target is impact-relevant), else 0. Geology analogs must be allowed through the bare-ground filter (rock under forest is still the right rock for sampling and drilling tests), or scored as a separate "geology track" list.

## Limits
- GLiM is the 0.5 deg gridded version: one dominant class per 0.5 deg, copied to the four 0.25 deg cells. No basalt_pct is possible from it (needs the polygon version). Small or coastal features are missed; 8,040 cells are "nd".
- GLiM has no anorthosite class. pb (basic plutonic) is the closest for the lunar highlands.
- Crater list: Earth Impact Database (PASSC), names and diameters for all 199. The original site is offline, so it was read from the Internet Archive snapshot of 10 May 2024. Coordinates are from EID for 185; for 14 whose pages were not archived, from Wikidata (8) or Wikipedia (6), marked in coord_source. Coordinates are to the arc-minute.
- A crater is assigned to the one cell containing its centre, even if it is larger than the cell (Sudbury, Vredefort, Chicxulub).
