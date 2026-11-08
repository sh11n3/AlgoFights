import { COLORS, LABELS, SHAPES, type Settings } from "../core/types";
import { defaults } from "../services/storage";
import {
  decodeLayouts,
  projectEdges,
  type GraphLayout,
} from "../graph/layouts";
import { PRESETS, type GraphPreset } from "../graph/presets";
import { LAB_PRESETS } from "../lab/presets";
import { GRAPH_LESSONS, STRING_LESSONS } from "../lab/catalog";
import { ROUTE_ALGORITHMS } from "../routing/types";
import CITIES from "../routing/cities.json";

export type SharedGraph = Pick<
  GraphLayout,
  | "name"
  | "description"
  | "points"
  | "edges"
  | "start"
  | "target"
  | "weighted"
  | "directed"
>;
export type Example =
  | { v: 1; kind: "arena"; settings: Settings }
  | {
      v: 1;
      kind: "city";
      city: string;
      algorithm: string;
      start?: [number, number];
      target?: [number, number];
      snapshot?: string;
      duration: number;
    }
  | {
      v: 1;
      kind: "graph-route";
      graph: SharedGraph;
      algorithm: string;
      limit: number;
      delay: number;
    }
  | {
      v: 1;
      kind: "graph-lesson";
      graph: SharedGraph;
      algorithm: string;
      mode: "source" | "target" | "all";
      limit: number;
      delay: number;
    }
  | {
      v: 1;
      kind: "string";
      algorithm: string;
      s: string;
      t: string;
      limit: number;
      delay: number;
    };
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max;
const integer = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const has = (map: object, v: unknown) =>
  typeof v === "string" && Object.hasOwn(map, v);
export const MAX_EXAMPLE_LENGTH = 24000;

export function snapshotGraph(
  preset: GraphPreset,
  weighted = preset.weighted ?? true,
  directed = preset.directed ?? false,
  start = preset.start,
  target = preset.target,
): SharedGraph {
  return {
    name: preset.name.slice(0, 48),
    description: preset.description.slice(0, 160),
    points: preset.points.map(([x, y]) => [x, y]),
    edges: projectEdges(preset.edges, directed),
    start,
    target,
    weighted,
    directed,
  };
}
export function readExample(value: unknown): Example {
  if (!object(value) || value.v !== 1)
    throw Error("Das Beispiel hat ein unbekanntes Format.");
  const limit = () => {
    if (!integer(value.limit, 1, 5000) || !integer(value.delay, 80, 2000))
      throw Error("Ungültiges Schrittlimit oder Tempo.");
    return { limit: value.limit as number, delay: value.delay as number };
  };
  if (value.kind === "arena") {
    const s = value.settings;
    if (
      !object(s) ||
      !has(SHAPES, s.shape) ||
      typeof s.resolution !== "number" ||
      ![256, 512, 1024].includes(s.resolution) ||
      !text(s.seed, 80) ||
      !integer(s.duration, 10, 15) ||
      !Array.isArray(s.participants) ||
      s.participants.length < 2 ||
      s.participants.length > 4
    )
      throw Error("Ungültige Arena-Einstellungen.");
    const participants = s.participants.map((p: unknown, i: number) => {
      if (
        !object(p) ||
        !has(LABELS, p.strategy) ||
        !text(p.name, 40) ||
        typeof p.strategy !== "string"
      )
        throw Error("Links unterstützen nur eingebaute Arena-Strategien.");
      return { name: p.name as string, strategy: p.strategy, color: COLORS[i] };
    });
    return {
      v: 1,
      kind: "arena",
      settings: {
        shape: s.shape as Settings["shape"],
        resolution: Number(s.resolution) as Settings["resolution"],
        seed: s.seed as string,
        duration: s.duration as number,
        participants,
      },
    };
  }
  if (value.kind === "city") {
    const point = (p: unknown): [number, number] | undefined => {
      if (p === undefined) return;
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        !p.every(Number.isFinite) ||
        Math.abs(p[0]) > 90 ||
        Math.abs(p[1]) > 180
      )
        throw Error("Ungültige Kartenposition.");
      return [p[0], p[1]];
    };
    if (
      !CITIES.some((c) => c.id === value.city) ||
      !has(ROUTE_ALGORITHMS, value.algorithm) ||
      !integer(value.duration, 5, 60) ||
      (value.snapshot !== undefined && !text(value.snapshot, 80))
    )
      throw Error("Unbekannte Stadt oder Wegsuche.");
    const start = point(value.start),
      target = point(value.target);
    if (!!start !== !!target)
      throw Error("Quelle und Ziel müssen zusammen angegeben werden.");
    return {
      v: 1,
      kind: "city",
      city: value.city as string,
      algorithm: value.algorithm as string,
      start,
      target,
      duration: value.duration as number,
      ...(value.snapshot ? { snapshot: value.snapshot as string } : {}),
    };
  }
  if (value.kind === "string") {
    if (
      !STRING_LESSONS.some((l) => l.id === value.algorithm) ||
      !text(value.s, 48) ||
      !text(value.t, 48)
    )
      throw Error("Ungültiges Zeichenkettenbeispiel.");
    return {
      v: 1,
      kind: "string",
      algorithm: value.algorithm as string,
      s: value.s as string,
      t: value.t as string,
      ...limit(),
    };
  }
  if (value.kind === "graph-route" || value.kind === "graph-lesson") {
    const g = value.graph;
    if (!object(g) || !text(g.description, 160) || !text(g.name, 48))
      throw Error("Ungültiger Graph.");
    const validated = decodeLayouts(
      JSON.stringify([
        { ...g, id: "layout:00000000-0000-0000-0000-000000000001" },
      ]),
    )[0];
    if (!validated)
      throw Error("Der Graph enthält ungültige Knoten, Kanten oder Endpunkte.");
    const graph = snapshotGraph(
      validated,
      validated.weighted,
      validated.directed,
    );
    if (value.kind === "graph-route") {
      if (!has(ROUTE_ALGORITHMS, value.algorithm))
        throw Error("Unbekannte Wegsuche.");
      const timing = limit();
      if (timing.limit > 500)
        throw Error(
          "Die Start–Ziel-Wegsuche unterstützt höchstens 500 Schritte.",
        );
      return {
        v: 1,
        kind: "graph-route",
        graph,
        algorithm: value.algorithm as string,
        ...timing,
      };
    }
    if (
      !GRAPH_LESSONS.some((l) => l.id === value.algorithm) ||
      !["source", "target", "all"].includes(String(value.mode))
    )
      throw Error("Unbekanntes Lehrverfahren oder Suchumfang.");
    return {
      v: 1,
      kind: "graph-lesson",
      graph,
      algorithm: value.algorithm as string,
      mode: value.mode as "source" | "target" | "all",
      ...limit(),
    };
  }
  throw Error("Unbekannte Simulationsart.");
}

export interface NamedExample {
  id: string;
  name: string;
  group: string;
  example: Example;
}
const graphPresets = [...PRESETS, ...LAB_PRESETS];
export const EXAMPLES: NamedExample[] = [
  ...GRAPH_LESSONS.map((lesson) => {
    const special =
      lesson.id === "trees"
        ? "lesson-rooted"
        : lesson.id === "kosaraju"
          ? "lesson-scc"
          : ["bellman", "floyd"].includes(lesson.id)
            ? "lesson-negative"
            : ["union", "components"].includes(lesson.id)
              ? "disconnected"
              : lesson.id === "topology"
                ? "dag"
                : PRESETS[0].id;
    const preset = graphPresets.find((p) => p.id === special)!;
    const directed = [
      "topology",
      "kosaraju",
      "bellman",
      "floyd",
      "trees",
    ].includes(lesson.id);
    return {
      id: `graph-${lesson.id}`,
      name: lesson.name,
      group: `Graph Sim · ${lesson.category}`,
      example: {
        v: 1,
        kind: "graph-lesson",
        graph: snapshotGraph(preset, preset.weighted ?? true, directed),
        algorithm: lesson.id,
        mode: ["bfs", "dfs", "cycle", "topology", "trees"].includes(lesson.id)
          ? "all"
          : "source",
        limit: 2000,
        delay: 450,
      } as Example,
    };
  }),
  ...STRING_LESSONS.map((lesson) => ({
    id: `string-${lesson.id}`,
    name: lesson.name,
    group: `String Sim · ${lesson.category}`,
    example: {
      v: 1,
      kind: "string",
      algorithm: lesson.id,
      s: ["kmp", "naive-match"].includes(lesson.id)
        ? "abaca"
        : lesson.id === "levenshtein-recursive"
          ? "rot"
          : "abcde",
      t: ["kmp", "naive-match"].includes(lesson.id)
        ? "ababacababaca"
        : lesson.id === "levenshtein-recursive"
          ? "rat"
          : "ace",
      limit: 2000,
      delay: 450,
    } as Example,
  })),
  ...Object.entries(ROUTE_ALGORITHMS).map(([id, info]) => ({
    id: `weg-${id}`,
    name: info.name,
    group: "Graph Sim · Start–Ziel-Wegsuche",
    example: {
      v: 1,
      kind: "graph-route",
      graph: snapshotGraph(PRESETS[0], true, false),
      algorithm: id,
      limit: 100,
      delay: 360,
    } as Example,
  })),
  ...CITIES.map((city) => ({
    id: `stadt-${city.id}`,
    name: city.name,
    group: "Algo Sim · Städte",
    example: {
      v: 1,
      kind: "city",
      city: city.id,
      algorithm: "dijkstra",
      start: [...city.start],
      target: [...city.target],
      duration: 12,
    } as Example,
  })),
  ...Object.entries(SHAPES).map(([shape, name]) => ({
    id: `arena-${shape}`,
    name,
    group: "Arena",
    example: {
      v: 1,
      kind: "arena",
      settings: {
        ...structuredClone(defaults),
        shape: shape as Settings["shape"],
        seed: "Vorlesung-1",
      },
    } as Example,
  })),
];
export function encodeExample(example: Example): string {
  const json = JSON.stringify(readExample(example));
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (encoded.length > MAX_EXAMPLE_LENGTH)
    throw Error("Dieses Beispiel ist für einen Link zu groß.");
  return encoded;
}
export function decodeExample(encoded: string): Example {
  if (
    !encoded ||
    encoded.length > MAX_EXAMPLE_LENGTH ||
    !/^[a-zA-Z0-9_-]+$/.test(encoded)
  )
    throw Error("Ungültiger oder zu großer Beispiel-Link.");
  try {
    return readExample(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(
            atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0),
          ),
        ),
      ),
    );
  } catch (error) {
    throw Error(
      `Beispiel konnte nicht geladen werden: ${error instanceof Error ? error.message : "Ungültige Daten"}`,
    );
  }
}
export function exampleHash(example: Example): string {
  const clean = JSON.stringify(readExample(example));
  const predefined = EXAMPLES.find(
    (item) => JSON.stringify(readExample(item.example)) === clean,
  );
  return predefined
    ? `#beispiel/${predefined.id}`
    : `#beispiel=${encodeExample(example)}`;
}
export function exampleUrl(
  example: Example,
  base = typeof location === "undefined"
    ? "https://algofights.de/"
    : location.href,
): string {
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("Beispiel-Links benötigen HTTP oder HTTPS.");
  url.username = "";
  url.password = "";
  url.hash = exampleHash(example);
  return url.href;
}
export function exampleFromHash(hash: string): Example | undefined {
  if (hash.startsWith("#beispiel=")) return decodeExample(hash.slice(10));
  if (hash.startsWith("#beispiel/")) {
    const item = EXAMPLES.find((e) => e.id === hash.slice(10));
    if (!item) throw Error("Dieses feste Beispiel ist unbekannt.");
    return readExample(item.example);
  }
}
export function exampleFromLink(value: string): Example {
  let hash = value;
  if (!value.startsWith("#")) {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw Error(
        "Bitte einen HTTP(S)-Beispiel-Link ohne Zugangsdaten einsetzen.",
      );
    hash = url.hash;
  }
  const example = exampleFromHash(hash);
  if (!example) throw Error("Bitte einen AlgoFights-Beispiel-Link einsetzen.");
  return example;
}
export function exampleTitle(e: Example): string {
  if (e.kind === "arena") return `Arena · ${SHAPES[e.settings.shape]}`;
  if (e.kind === "city")
    return `${ROUTE_ALGORITHMS[e.algorithm as keyof typeof ROUTE_ALGORITHMS].name} · ${CITIES.find((c) => c.id === e.city)?.name}`;
  if (e.kind === "graph-route")
    return `${ROUTE_ALGORITHMS[e.algorithm as keyof typeof ROUTE_ALGORITHMS].name} · ${e.graph.name}`;
  return (
    [...GRAPH_LESSONS, ...STRING_LESSONS].find((l) => l.id === e.algorithm)
      ?.name ?? "Beispiel"
  );
}
