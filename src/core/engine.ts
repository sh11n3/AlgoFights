import { createArena, startPositions } from "./arena";
import { hashSeed, random } from "./random";
import { chooseBuiltin, legalMoves, neighbor } from "./strategies";
import {
  DIRECTIONS,
  type Arena,
  type CustomAnswer,
  type CustomChoose,
  type Direction,
  type Player,
  type Replay,
  type Settings,
} from "./types";

export class Simulation {
  readonly arena: Arena;
  readonly board: Int8Array;
  readonly players: Player[];
  readonly starts: number[];
  readonly events: number[] = [];
  readonly offsets: number[] = [0];
  readonly rng: () => number;
  readonly playerRng: Array<() => number>;
  step = 0;
  occupied = 0;
  finished = false;
  constructor(
    readonly settings: Settings,
    arena?: Arena,
    starts?: number[],
  ) {
    if (settings.participants.length < 2 || settings.participants.length > 4)
      throw new Error("Wähle zwei bis vier Teilnehmer.");
    this.arena = arena ?? createArena(settings.shape, settings.resolution);
    this.starts =
      starts ??
      startPositions(this.arena, settings.participants.length, settings.seed);
    this.board = new Int8Array(this.arena.mask.length);
    for (let i = 0; i < this.board.length; i++)
      this.board[i] = this.arena.mask[i] ? -1 : -2;
    this.rng = random(hashSeed(settings.seed + ":conflicts"));
    this.playerRng = settings.participants.map((_, i) =>
      random(hashSeed(settings.seed + ":player:" + i)),
    );
    this.players = settings.participants.map((p, id) => {
      const position = this.starts[id]!;
      if (
        position < 0 ||
        position >= this.board.length ||
        this.board[position] !== -1
      )
        throw new Error("Ungültige oder doppelte Startzelle.");
      this.board[position] = id;
      this.events.push((position << 2) | id);
      this.occupied++;
      return {
        ...p,
        id,
        position,
        direction: DIRECTIONS[id % 4]!,
        score: 1,
        status: "active",
        stoppedAt: -1,
      };
    });
    this.offsets.push(this.events.length);
  }
  private stop(p: Player, error?: string) {
    p.status = error ? "error" : "blocked";
    p.stoppedAt = this.step;
    if (error) p.error = error;
  }
  private prepare(): Map<number, Direction[]> {
    this.step++;
    const legal = new Map<number, Direction[]>();
    for (const p of this.players)
      if (p.status === "active") {
        const moves = legalMoves(p, this.board, this.arena);
        if (!moves.length) this.stop(p);
        else legal.set(p.id, moves);
      }
    return legal;
  }
  private resolve(
    choices: Map<number, CustomAnswer>,
    legal: Map<number, Direction[]>,
  ) {
    const targets = new Map<number, Player[]>();
    for (const p of this.players) {
      if (!legal.has(p.id)) continue;
      const choice = choices.get(p.id);
      if (choice?.error) {
        this.stop(p, choice.error);
        continue;
      }
      if (!choice?.direction || !DIRECTIONS.includes(choice.direction)) {
        this.stop(
          p,
          'Rückgabe benötigt direction: "up", "right", "down" oder "left".',
        );
        continue;
      }
      if (!legal.get(p.id)!.includes(choice.direction)) {
        this.stop(
          p,
          "Der gewählte Zug führt auf eine belegte Zelle oder außerhalb der Arena.",
        );
        continue;
      }
      const target = neighbor(
        p.position,
        choice.direction,
        this.arena.width,
        this.arena.height,
      );
      const contenders = targets.get(target) ?? [];
      contenders.push(p);
      targets.set(target, contenders);
    }
    for (const [target, contenders] of targets) {
      const winner =
        contenders.length === 1
          ? contenders[0]!
          : contenders[Math.floor(this.rng() * contenders.length)]!;
      // All targets were validated against the same, unchanged pre-step board.
      winner.position = target;
      winner.direction = choices.get(winner.id)!.direction!;
      winner.score++;
      this.occupied++;
      this.board[target] = winner.id;
      this.events.push((target << 2) | winner.id);
    }
    this.offsets.push(this.events.length);
    this.finished =
      this.occupied === this.arena.playable ||
      this.players.every((p) => p.status !== "active");
    if (this.finished)
      for (const p of this.players) if (p.status === "active") this.stop(p);
  }
  tick(forced?: Map<number, CustomAnswer>) {
    if (this.finished) return;
    const legal = this.prepare(),
      choices = new Map<number, CustomAnswer>();
    for (const p of this.players)
      if (legal.has(p.id))
        choices.set(
          p.id,
          forced?.get(p.id) ?? {
            direction: chooseBuiltin(
              p,
              legal.get(p.id)!,
              this.board,
              this.arena,
              this.playerRng[p.id]!,
            ),
          },
        );
    this.resolve(choices, legal);
  }
  async tickCustom(choose: CustomChoose, delta: Uint32Array) {
    if (this.finished) return;
    const legal = this.prepare(),
      choices = new Map<number, CustomAnswer>();
    await Promise.all(
      this.players
        .filter((p) => legal.has(p.id))
        .map(async (p) => {
          let choice: CustomAnswer;
          if (p.code !== undefined) {
            try {
              choice = await choose(p, {
                id: p.id,
                position: p.position,
                direction: p.direction,
                score: p.score,
                step: this.step,
                delta,
              });
            } catch (e) {
              choice = {
                error:
                  e instanceof Error ? e.message : "Ausführung fehlgeschlagen.",
              };
            }
          } else
            choice = {
              direction: chooseBuiltin(
                p,
                legal.get(p.id)!,
                this.board,
                this.arena,
                this.playerRng[p.id]!,
              ),
            };
          choices.set(p.id, choice);
        }),
    );
    this.resolve(choices, legal);
  }
  replay(elapsed: number): Replay {
    return {
      settings: this.settings,
      arena: this.arena,
      players: this.players,
      starts: this.starts,
      events: Uint32Array.from(this.events),
      offsets: Uint32Array.from(this.offsets),
      steps: this.step,
      elapsed,
      occupied: this.occupied,
    };
  }
}
