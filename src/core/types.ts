export const DIRECTIONS = ["up", "right", "down", "left"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type ArenaShape = "circle" | "square" | "ring" | "rooms";
export type Builtin = "right" | "left" | "lookahead" | "random";
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
};
export const SHAPES: Record<ArenaShape, string> = {
  circle: "Kreis",
  square: "Quadrat",
  ring: "Ring",
  rooms: "Kammern",
};
