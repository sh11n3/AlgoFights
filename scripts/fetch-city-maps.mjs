/** Refresh the checked-in OSM snapshots. No API key, live map service, or backend needed. */
import { mkdir, writeFile } from "node:fs/promises";
import cities from "../src/routing/cities.json" with { type: "json" };
const requested = new Set(process.argv.slice(2));
if ([...requested].some((id) => !cities.some((city) => city.id === id)))
  throw new Error(
    "Unbekannte Stadt. Erlaubt: " + cities.map((city) => city.id).join(", "),
  );
await mkdir("public/maps", { recursive: true });
for (const city of cities) {
  if (requested.size && !requested.has(city.id)) continue;
  console.log(`Lade ${city.name} …`);
  const b = city.bbox.join(",");
  const query = `[out:json][timeout:90];(way[highway][highway!~"^(footway|path|steps|cycleway|bridleway|construction|proposed|platform|raceway)$"](${b});way[natural=water](${b});way[waterway=riverbank](${b});way[leisure=park](${b});node[place~"^(suburb|quarter|neighbourhood)$"](${b}););out body;>;out skel qt;`;
  let data, provider;
  const hosts =
    city.overpass === "global"
      ? [
          "https://overpass-api.de/api/interpreter",
          "https://overpass.private.coffee/api/interpreter",
        ]
      : ["https://ovp.dresel.systems/api/interpreter"];
  for (const host of hosts) {
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
      provider = host;
      break;
    } catch (e) {
      console.log(
        `${city.id}: ${new URL(host).hostname}: ${e.message} ${e.cause?.code ?? ""}`,
      );
    }
  }
  if (!data) throw new Error(`OSM-Download für ${city.id} fehlgeschlagen`);
  const result = {
    id: city.id,
    name: city.name,
    bbox: city.bbox,
    center: city.center,
    downloadedAt: new Date().toISOString(),
    osmTimestamp: data.osm3s?.timestamp_osm_base,
    source: "https://www.openstreetmap.org/copyright",
    overpass: provider,
    license: "ODbL-1.0",
    elements: data.elements,
  };
  const text = JSON.stringify(result);
  await writeFile(`public/maps/${city.id}.json`, text);
  console.log(
    `${city.id}: ${data.elements.length} elements, ${(text.length / 1024).toFixed(0)} KiB`,
  );
}
