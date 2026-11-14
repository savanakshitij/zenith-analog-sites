/*
 * Photo catalog for the side-by-side comparisons.
 *
 * Every file is on Wikimedia Commons (file pages found and checked by name).
 * Images load through Special:FilePath, which redirects to a resized copy.
 * Most space images are NASA (public domain); Earth photos are under the
 * licence shown on each file page. Check the page before reusing an image
 * outside the hackathon.
 */
(function (root) {
  const COMMONS = "https://commons.wikimedia.org/wiki/";
  const img = (file, caption, credit) => ({
    file, caption, credit,
    src: (w = 640) => `${COMMONS}Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${w}`,
    page: `${COMMONS}File:${encodeURIComponent(file.replace(/ /g, "_"))}`,
  });

  const BASE_IMAGES = {
    shackleton: [
      img("Shackleton Crater.jpg", "Shackleton crater at the lunar south pole", "NASA"),
      img("South Pole Illumination Map (LROC271).png", "How much sunlight the south pole gets (LRO)", "NASA/GSFC/ASU"),
      img("LRO WAC South Pole Mosaic.jpg", "LRO wide-angle mosaic of the south pole", "NASA/GSFC/ASU"),
    ],
    malapert: [
      img("LRO WAC South Pole Mosaic.jpg", "South polar region around Malapert (LRO)", "NASA/GSFC/ASU"),
      img("South Pole Illumination Map (LROC271).png", "Sunlit peaks near the south pole (LRO)", "NASA/GSFC/ASU"),
    ],
    marius: [
      img("Marius Hills Pit - Lava Tube Skylight? (LROC202 - M114328462R thumb).png", "Marius Hills pit, a possible lava-tube skylight", "NASA/GSFC/ASU"),
      img("Marius Hills AS12-52-7754.jpg", "Marius Hills volcanic domes from Apollo 12", "NASA"),
    ],
    arcadia: [
      img("Evaporating ice on Mars Phoenix lander image.jpg", "Shallow ground ice dug up by Phoenix (like Arcadia's buried ice)", "NASA/JPL-Caltech/Univ. of Arizona"),
      img("Phoenix Ice.jpg", "Bright ice just under the Martian soil", "NASA/JPL-Caltech/Univ. of Arizona"),
    ],
    jezero: [
      img("NASA-Mars-JezeroCrater-20181116.jpg", "Jezero crater and its river delta", "NASA/JPL-Caltech"),
      img("Jezero Crater channel.JPG", "Ancient channel feeding Jezero's lake", "NASA/JPL-Caltech"),
    ],
    gale: [
      img("PIA16068 - Mars Curiosity Rover - Aeolis Mons - 20120817.jpg", "Mount Sharp (Aeolis Mons) seen by Curiosity", "NASA/JPL-Caltech/MSSS"),
      img("Namib dune, Gale Crater Mars.jpg", "Namib dune inside Gale crater", "NASA/JPL-Caltech/MSSS"),
      img("Conglomerate on mars.jpg", "River pebbles in Gale crater", "NASA/JPL-Caltech/MSSS"),
    ],
    meridiani: [
      img("Martian blueberries.jpg", "Hematite 'blueberries' at Meridiani", "NASA/JPL-Caltech"),
      img("Meridiani surface hematite map.jpg", "Hematite map of Meridiani from orbit (TES)", "NASA/JPL/ASU"),
    ],
  };

  const SITE_IMAGES = {
    haughton: [
      img("Haughton Crater - Landsat 8 (48010457521).png", "Haughton crater from Landsat 8", "NASA/USGS Landsat"),
      img("K10 black rover at Haughton Crater.jpg", "NASA K10 rover testing at Haughton", "NASA"),
    ],
    dryvalleys: [img("Dry Valleys, Antarctica.jpg", "McMurdo Dry Valleys, Antarctica", "Wikimedia Commons")],
    concordia: [img("Concordia Station at Dome C.jpg", "Concordia Station on the Antarctic plateau", "Wikimedia Commons")],
    maunakea: [img("Cinder cones on Mauna Kea.JPG", "Cinder cones on Mauna Kea", "Wikimedia Commons")],
    cratersmoon: [
      img("Indian Tunnel is the largest and most accessible public cave at Craters of the Moon at 800 feet long and 30 feet high. Large (27bcf3e7-c5b4-18c1-1411-c5d426efe111).jpg", "Indian Tunnel lava tube, Craters of the Moon", "NPS"),
      img("Cinder cone volcano (Holocene; Big Cinder Butte, Craters of the Moon Lava Field, Snake River Plain, Idaho, USA) 2.jpg", "Cinder cone at Craters of the Moon", "James St. John"),
    ],
    atacama: [img("Desierto de Atacama.JPG", "Atacama Desert, Chile", "Wikimedia Commons")],
    mdrs: [img("Mars Desert Research Station.jpg", "Mars Desert Research Station, Utah", "Wikimedia Commons")],
    qaidam: [img("Yardangs in the Tsaidam Desert.jpg", "Wind-carved yardangs in the Qaidam Basin", "Wikimedia Commons")],
    pilbara: [img("Stromatolite (Strelley Pool Formation, Paleoarchean, 3.35-3.46 Ga; East Strelley Greenstone Belt, Pilbara Craton, Western Australia) 1 (17346619166).jpg", "3.4-billion-year-old stromatolite, Pilbara", "James St. John")],
    riotinto: [img("Rio tinto river CarolStoker NASA Ames Research Center.jpg", "Río Tinto's acidic red water", "Carol Stoker, NASA Ames")],
    badwater: [img("Badwater salt formations.jpg", "Salt crust at Badwater Basin", "Wikimedia Commons")],
    meteorcrater: [img("Meteor Crater, Arizona (ASTER).jpg", "Meteor Crater from NASA's ASTER", "NASA/METI/AIST/Japan Space Systems")],
    lonar: [img("Lonar Crater Lake from space NASA.JPG", "Lonar crater lake from space", "NASA")],
    holuhraun: [img("Holuhraun Natural Color OLI Landsat 8.jpg", "Holuhraun lava field from Landsat 8", "NASA/USGS Landsat")],
    wadirum: [img("Wadi Rum Dry Desert, Jordan.jpg", "Wadi Rum desert, Jordan", "Wikimedia Commons")],
    lanzarote: [img("Lanzarote's Lunar-Like Landscape.jpg", "Lanzarote's lunar-like volcanic landscape", "Wikimedia Commons")],
  };

  const API = { BASE_IMAGES, SITE_IMAGES };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.ANALOG_IMAGES = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
