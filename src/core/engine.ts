import { createArena, startPositions } from "./arena";
import { hashSeed, random } from "./random";
import { chooseBuiltin, legalMoves, neighbor } from "./strategies";
import {
  DIRECTIONS,
  RELOCATION_FLAG,
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
  private readonly restartRng: () => number;
  private readonly freeCells: Uint32Array;
  private readonly freeIndex: Int32Array;
  private freeCount: number;
  private readonly frontiers: number[][];
  private readonly relocations = new Map<number, number>();
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
    this.freeCells = new Uint32Array(this.arena.playable);
    this.freeIndex = new Int32Array(this.board.length).fill(-1);
    this.freeCount = this.arena.playable;
    let cursor = 0;
    for (let i = 0; i < this.board.length; i++) {
      this.board[i] = this.arena.mask[i] ? -1 : -2;
      if (this.arena.mask[i]) {
        this.freeCells[cursor] = i;
        this.freeIndex[i] = cursor++;
      }
    }
    this.rng = random(hashSeed(settings.seed + ":conflicts"));
    this.restartRng = random(hashSeed(settings.seed + ":relocations"));
    this.playerRng = settings.participants.map((_, i) =>
      random(hashSeed(settings.seed + ":player:" + i)),
    );
    this.frontiers = settings.participants.map(() => []);
    this.players = settings.participants.map((p, id) => {
      const position = this.starts[id]!;
      if (
        position < 0 ||
        position >= this.board.length ||
        this.board[position] !== -1
      )
        throw new Error("Ungültige oder doppelte Startzelle.");
      this.claim(position, id);
      return {
        ...p,
        id,
        position,
        direction: DIRECTIONS[id % 4]!,
        score: 1,
        status: "active",
        stoppedAt: -1,
        errorAt: -1,
        fallback: false,
        restarts: 0,
        lastRestartAt: -1,
      };
    });
    this.offsets.push(this.events.length);
    this.finished = this.freeCount === 0;
    if (this.finished) this.finish();
  }

  private claim(cell: number, id: number, relocated = false) {
    this.board[cell] = id;
    const index = this.freeIndex[cell]!;
    const last = this.freeCells[--this.freeCount]!;
    this.freeCells[index] = last;
    this.freeIndex[last] = index;
    this.freeIndex[cell] = -1;
    this.occupied++;
    this.events.push(
      ((cell << 2) | id | (relocated ? RELOCATION_FLAG : 0)) >>> 0,
    );
    for (const direction of DIRECTIONS) {
      const n = neighbor(cell, direction, this.arena.width, this.arena.height);
      if (n >= 0 && this.board[n] === -1) this.frontiers[id]!.push(n);
    }
  }

  private restartTarget(p: Player): number {
    const frontier = this.frontiers[p.id]!;
    while (frontier.length) {
      const cell = frontier.pop()!;
      if (this.board[cell] === -1) return cell;
    }
    // Dense free-cell pool makes isolated pockets reachable in constant time.
    return this.freeCells[Math.floor(this.restartRng() * this.freeCount)]!;
  }

  private useFallback(p: Player, error: string) {
    if (!p.fallback) {
      p.error = error;
      p.errorAt = this.step;
      p.fallback = true;
    }
  }

  private finish() {
    for (const p of this.players) {
      p.status = p.fallback ? "error" : "blocked";
      p.stoppedAt = this.step;
    }
  }

  private prepare(): Map<number, Direction[]> {
    this.step++;
    this.relocations.clear();
    const legal = new Map<number, Direction[]>();
    // No mutations: every decision, including a relocation, sees the same board.
    for (const p of this.players) {
      const moves = legalMoves(p, this.board, this.arena);
      if (moves.length) legal.set(p.id, moves);
    }
    // Start a new pass only after every head is blocked. Strong strategies can
    // keep scoring while trapped opponents wait, preserving meaningful rankings.
    if (!legal.size)
      for (const p of this.players)
        this.relocations.set(p.id, this.restartTarget(p));
    return legal;
  }

  private builtin(p: Player, legal: Direction[]): Direction {
    return chooseBuiltin(
      p.fallback ? { ...p, strategy: "straight" } : p,
      legal,
      this.board,
      this.arena,
      this.playerRng[p.id]!,
    );
  }

  private resolve(
    choices: Map<number, CustomAnswer>,
    legal: Map<number, Direction[]>,
  ) {
    const targets = new Map<number, Player[]>();
    const directions = new Map<number, Direction>();
    for (const p of this.players) {
      let target = this.relocations.get(p.id);
      if (target === undefined) {
        const moves = legal.get(p.id);
        if (!moves) continue;
        const choice = choices.get(p.id);
        let error = choice?.error;
        if (
          !error &&
          (!choice?.direction || !DIRECTIONS.includes(choice.direction))
        )
          error =
            'Rückgabe benötigt direction: "up", "right", "down" oder "left".';
        if (!error && !moves.includes(choice!.direction!))
          error =
            "Der gewählte Zug führt auf eine belegte Zelle oder außerhalb der Arena.";
        if (error) this.useFallback(p, error);
        const direction = error ? this.builtin(p, moves) : choice!.direction!;
        directions.set(p.id, direction);
        target = neighbor(
          p.position,
          direction,
          this.arena.width,
          this.arena.height,
        );
      }
      const contenders = targets.get(target) ?? [];
      contenders.push(p);
      targets.set(target, contenders);
    }
    for (const [target, contenders] of targets) {
      const winner =
        contenders.length === 1
          ? contenders[0]!
          : contenders[Math.floor(this.rng() * contenders.length)]!;
      const relocated = this.relocations.has(winner.id);
      winner.position = target;
      if (relocated) {
        winner.restarts++;
        winner.lastRestartAt = this.step;
      } else winner.direction = directions.get(winner.id)!;
      winner.score++;
      this.claim(target, winner.id, relocated);
    }
    this.offsets.push(this.events.length);
    this.finished = this.freeCount === 0;
    if (this.finished) this.finish();
  }

  tick(forced?: Map<number, CustomAnswer>) {
    if (this.finished) return;
    const legal = this.prepare(),
      choices = new Map<number, CustomAnswer>();
    for (const p of this.players)
      if (legal.has(p.id))
        choices.set(
          p.id,
          forced?.get(p.id) ?? { direction: this.builtin(p, legal.get(p.id)!) },
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
          if (p.code !== undefined && !p.fallback) {
            try {
              choice = await choose(p, {
                id: p.id,
                position: p.position,
                direction: p.direction,
                score: p.score,
                step: this.step,
                delta,
                restarts: p.restarts,
                restarted: p.lastRestartAt === this.step - 1,
              });
            } catch (e) {
              choice = {
                error:
                  e instanceof Error ? e.message : "Ausführung fehlgeschlagen.",
              };
            }
          } else choice = { direction: this.builtin(p, legal.get(p.id)!) };
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
