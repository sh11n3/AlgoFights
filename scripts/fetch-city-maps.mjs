/** Refresh the checked-in OSM snapshots. No API key, live map service, or backend needed. */
import { mkdir, writeFile } from "node:fs/promises";
const cities = [
  {
    id: "berlin",
    name: "Berlin · Mitte",
    bbox: [52.502, 13.365, 52.535, 13.43],
    center: [52.519, 13.399],
  },
  {
    id: "mannheim",
    name: "Mannheim · Quadrate",
    bbox: [49.475, 8.445, 49.497, 8.487],
    center: [49.487, 8.466],
  },
];
await mkdir("public/maps", { recursive: true });
for (const city of cities) {
  const b = city.bbox.join(",");
  const query = `[out:json][timeout:90];(way[highway][highway!~"^(footway|path|steps|cycleway|bridleway|construction|proposed|platform|raceway)$"](${b});way[natural=water](${b});way[waterway=riverbank](${b});way[leisure=park](${b});node[place~"^(suburb|quarter|neighbourhood)$"](${b}););out body;>;out skel qt;`;
  let data;
  for (const host of ["https://ovp.dresel.systems/api/interpreter"]) {
    try {
      const response = await fetch(host, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(115000),
        headers: {
          "User-Agent":
            "AlgoFights/1.0 (educational OSM snapshot; github.com/sh11n3/AlgoFights)",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const candidate = await response.json();
      if (!candidate.elements?.length || candidate.remark)
        throw new Error(candidate.remark || "Empty map");
      data = candidate;
      break;
    } catch (e) {
      console.log(
        `${city.id}: ${new URL(host).hostname}: ${e.message} ${e.cause?.code ?? ""}`,
      );
    }
  }
  if (!data) throw new Error(`OSM-Download für ${city.id} fehlgeschlagen`);
  const result = {
    ...city,
    downloadedAt: new Date().toISOString(),
    osmTimestamp: data.osm3s?.timestamp_osm_base,
    source: "https://www.openstreetmap.org/copyright",
    license: "ODbL-1.0",
    elements: data.elements,
  };
  const text = JSON.stringify(result);
  await writeFile(`public/maps/${city.id}.json`, text);
  console.log(
    `${city.id}: ${data.elements.length} elements, ${(text.length / 1024).toFixed(0)} KiB`,
  );
}
