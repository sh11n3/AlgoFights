import type { SearchNetwork } from "../routing/types";

export interface SearchArrayState {
  side: number;
  dis?: number[];
  pre: number[];
}

export function createArrayTrace(
  nodeCount: number,
  arcs: SearchNetwork["arcs"],
): {
  track(
    dis: ArrayLike<number> | null,
    previous: ArrayLike<number> | Map<number, number>,
    side?: number,
  ): void;
  capture(): void;
  frames: SearchArrayState[][];
};
