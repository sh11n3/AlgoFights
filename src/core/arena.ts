import type { Arena, ArenaShape } from "./types";
import { hashSeed, random } from "./random";

// Coordinates are normalized. Adding a form only requires another predicate.
export const masks: Record<ArenaShape, (x: number, y: number) => boolean> = {
  circle: (x, y) => x * x + y * y <= 0.94 ** 2,
  square: (x, y) => Math.abs(x) <= 0.9 && Math.abs(y) <= 0.9,
  ring: (x, y) => x * x + y * y <= 0.94 ** 2 && x * x + y * y >= 0.37 ** 2,
  rooms: (x, y) =>
    (Math.abs(x) < 0.83 && Math.abs(y) < 0.08) ||
    (Math.abs(y) < 0.83 && Math.abs(x) < 0.08) ||
    [-0.49, 0.49].some((cx) =>
      [-0.49, 0.49].some(
        (cy) => Math.abs(x - cx) < 0.37 && Math.abs(y - cy) < 0.37,
      ),
    ) ||
    (Math.abs(x) < 0.57 && Math.abs(y) < 0.2) ||
    (Math.abs(y) < 0.57 && Math.abs(x) < 0.2),
  star: (x, y) =>
    Math.hypot(x, y) <= 0.7 + 0.22 * Math.cos(8 * Math.atan2(y, x)),
  maze: (x, y) => {
    const radius = Math.hypot(x, y);
    if (radius > 0.94) return false;
    const angle = Math.atan2(y, x);
    // Three circular walls, with four gates alternating by 45 degrees.
    for (let ring = 0; ring < 3; ring++) {
      const inner = 0.23 * (ring + 1);
      if (radius >= inner && radius <= inner + 0.05)
        return (
          Math.abs(ring % 2 ? Math.cos(2 * angle) : Math.sin(2 * angle)) < 0.16
        );
    }
    return true;
  },
  bridges: (x, y) =>
    (Math.abs(Math.abs(x) - 0.48) <= 0.055 && Math.abs(y) <= 0.48) ||
    (Math.abs(Math.abs(y) - 0.48) <= 0.055 && Math.abs(x) <= 0.48) ||
    (Math.abs(x) - 0.48) ** 2 + (Math.abs(y) - 0.48) ** 2 <= 0.33 ** 2,
};
export function createArena(shape: ArenaShape, resolution: number): Arena {
  if (
    !masks[shape] ||
    !Number.isInteger(resolution) ||
    resolution < 4 ||
    resolution > 1024
  )
    throw new Error("Ungültige Arena oder Rasterauflösung.");
  const mask = new Uint8Array(resolution * resolution);
  let playable = 0;
  for (let y = 0; y < resolution; y++)
    for (let x = 0; x < resolution; x++) {
      const inside = masks[shape](
        ((x + 0.5) / resolution) * 2 - 1,
        ((y + 0.5) / resolution) * 2 - 1,
      );
      if (inside) {
        mask[y * resolution + x] = 1;
        playable++;
      }
    }
  return { width: resolution, height: resolution, mask, playable };
}
export function startPositions(
  arena: Arena,
  count: number,
  seed: string,
): number[] {
  const phase = random(hashSeed(seed + ":starts"))() * Math.PI * 2;
  const used = new Set<number>();
  for (let p = 0; p < count; p++) {
    const angle = phase + (p * Math.PI * 2) / count;
    const tx = (0.5 + Math.cos(angle) * 0.32) * arena.width;
    const ty = (0.5 + Math.sin(angle) * 0.32) * arena.height;
    let best = -1,
      distance = Infinity;
    for (let i = 0; i < arena.mask.length; i++) {
      if (!arena.mask[i] || used.has(i)) continue;
      const d =
        ((i % arena.width) - tx) ** 2 + (Math.floor(i / arena.width) - ty) ** 2;
      if (d < distance) {
        distance = d;
        best = i;
      }
    }
    if (best < 0) throw new Error("Nicht genügend gültige Startzellen.");
    used.add(best);
  }
  return [...used];
}
