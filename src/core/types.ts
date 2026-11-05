export const DIRECTIONS = ["up", "right", "down", "left"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type ArenaShape =
  "circle" | "square" | "ring" | "rooms" | "star" | "maze" | "bridges";
export type Builtin =
  | "right"
  | "left"
  | "lookahead"
  | "random"
  | "straight"
  | "zigzag"
  | "serpentine"
  | "spiral"
  | "edge"
  | "invasion";
export type Status = "active" | "blocked" | "error";
export interface ParticipantConfig {
  name: string;
  strategy: string;
  color: string;
  code?: string;
}
export interface Settings {
  shape: ArenaShape;
  resolution: number;
  seed: string;
  duration: number;
  participants: ParticipantConfig[];
}
export interface CustomStrategy {
  id: string;
  name: string;
  code: string;
}
export interface Player extends ParticipantConfig {
  id: number;
  position: number;
  direction: Direction;
  score: number;
  status: Status;
  stoppedAt: number;
  error?: string;
  errorAt: number;
  fallback: boolean;
  restarts: number;
  lastRestartAt: number;
  returnSteps: number;
}
export interface Arena {
  width: number;
  height: number;
  mask: Uint8Array;
  playable: number;
}
export interface MoveResult {
  direction: Direction;
}
export interface Replay {
  settings: Settings;
  arena: Arena;
  players: Player[];
  starts: number[];
  events: Uint32Array;
  offsets: Uint32Array;
  steps: number;
  elapsed: number;
  occupied: number;
}
export interface CustomRequest {
  id: number;
  position: number;
  direction: Direction;
  score: number;
  step: number;
  delta: Uint32Array;
  restarts: number;
  restarted: boolean;
  returnSteps: number;
}
export interface CustomAnswer {
  direction?: Direction;
  error?: string;
}
export type CustomChoose = (
  player: Player,
  request: CustomRequest,
) => Promise<CustomAnswer>;
export const COLORS = ["#51d8ed", "#f479b5", "#a8e6bd", "#f4cd72"];
export const LABELS: Record<string, string> = {
  right: "Rechtsorientiert",
  left: "Linksorientiert",
  lookahead: "Lookahead",
  random: "Zufall",
  straight: "Geradeaus",
  zigzag: "Zickzack",
  serpentine: "Zeilenläufer",
  spiral: "Spirale",
  edge: "Kantenläufer",
  invasion: "Invasion",
};
export const DESCRIPTIONS: Record<string, string> = {
  right: "Rechts, geradeaus, links, zurück.",
  left: "Links, geradeaus, rechts, zurück.",
  lookahead: "Sucht lokal nach Wegen mit viel freiem Raum.",
  random: "Wählt jeden freien Nachbarn mit Seed-Zufall.",
  straight: "Bleibt möglichst lange in derselben Richtung.",
  zigzag: "Wechselt zwischen horizontalen und vertikalen Zügen.",
  serpentine: "Füllt das Raster in wechselnden horizontalen Bahnen.",
  spiral: "Folgt einer nach außen wachsenden rechtwinkligen Spirale.",
  edge: "Bevorzugt freie Zellen entlang bestehender Grenzen.",
  invasion: "Steuert auf die Spuren anderer Teilnehmer zu.",
};
// Movement events retain every adjacent return step, without changing ownership.
export const TRANSIT_FLAG = 0x80000000;
export const RETURN_START_FLAG = 0x40000000;
export const RETURN_END_FLAG = 0x20000000;
export function eventCell(event: number): number {
  return (event & 0x1fffffff) >>> 2;
}
export const SHAPES: Record<ArenaShape, string> = {
  circle: "Kreis",
  square: "Quadrat",
  ring: "Ring",
  rooms: "Kammern",
  star: "Stern",
  maze: "Labyrinth",
  bridges: "Brücken",
};
