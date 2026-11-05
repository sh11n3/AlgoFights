import {
  COLORS,
  LABELS,
  SHAPES,
  type CustomStrategy,
  type Settings,
} from "../core/types";

export const TEMPLATE = `// Freie Nachbarn prüfen, mit Seed-Zufall auswählen.
function nextMove(state, memory) {
  const moves = state.availableMoves;
  const index = Math.floor(state.random() * moves.length);

  return {
    direction: moves[index],
    memory: { turns: (memory.turns || 0) + 1 }
  };
}`;
export const defaults: Settings = {
  shape: "circle",
  resolution: 512,
  seed: "AF-0037",
  duration: 12,
  participants: ["right", "left", "lookahead", "random"].map((strategy, i) => ({
    name: LABELS[strategy]!,
    strategy,
    color: COLORS[i]!,
  })),
};
export function readSettings(): Settings {
  try {
    const parsed = JSON.parse(
      localStorage.getItem("algofights.settings.v1") || "null",
    );
    if (
      parsed &&
      typeof parsed.shape === "string" &&
      Object.hasOwn(SHAPES, parsed.shape) &&
      [256, 512, 1024].includes(parsed.resolution) &&
      typeof parsed.seed === "string" &&
      parsed.seed.length <= 80 &&
      parsed.duration >= 10 &&
      parsed.duration <= 15 &&
      Array.isArray(parsed.participants) &&
      parsed.participants.length >= 2 &&
      parsed.participants.length <= 4 &&
      parsed.participants.every(
        (p: { strategy?: unknown; name?: unknown }) =>
          typeof p.strategy === "string" && typeof p.name === "string",
      )
    ) {
      parsed.participants.forEach(
        (p: { color: string; code?: string }, i: number) => {
          p.color = COLORS[i]!;
          delete p.code;
        },
      );
      return parsed;
    }
  } catch {
    /* Fresh defaults also work when browser storage is unavailable. */
  }
  return structuredClone(defaults);
}
export function readStrategies(
  kind = "strategies",
  prefix = "custom:",
): CustomStrategy[] {
  try {
    const data = JSON.parse(
      localStorage.getItem(`algofights.${kind}.v1`) || "[]",
    );
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (s) =>
          typeof s.id === "string" &&
          s.id.startsWith(prefix) &&
          typeof s.name === "string" &&
          s.name.length <= 40 &&
          typeof s.code === "string" &&
          s.code.length <= 50000,
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}
export function store(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(`algofights.${key}.v1`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
