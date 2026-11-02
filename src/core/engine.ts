import { createArena, startPositions } from "./arena";
import { hashSeed, random } from "./random";
import { chooseBuiltin, legalMoves, neighbor } from "./strategies";
import {
  DIRECTIONS,
  TRANSIT_FLAG,
  RETURN_START_FLAG,
  RETURN_END_FLAG,
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
  private routes = new Map<number, number[]>();
  private freshRoutes = new Set<number>();
  private returned = new Set<number>();
  private transitTargets = new Map<number, number>();
  private seen: Uint32Array;
  private previous: Int32Array;
  private queue: Uint32Array;
  private searchId = 0;
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
    this.seen = new Uint32Array(this.board.length);
    this.previous = new Int32Array(this.board.length);
    this.queue = new Uint32Array(this.board.length);
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
        returnSteps: 0,
      };
    });
    this.offsets.push(this.events.length);
    this.finished = this.occupied === this.arena.playable;
    if (this.finished) this.finish();
  }

  private claim(cell: number, id: number) {
    this.board[cell] = id;
    this.occupied++;
    this.events.push((cell << 2) | id);
  }

  // Breadth-first search on occupied cells, ending at the nearest free cell.
  // Search buffers are reused; no full-array clearing or flood fill per normal move.
  private routeToFree(start: number): number[] | null {
    if (++this.searchId === 0xffffffff) {
      this.seen.fill(0);
      this.searchId = 1;
    }
    let head = 0,
      tail = 1;
    this.queue[0] = start;
    this.seen[start] = this.searchId;
    while (head < tail) {
      const cell = this.queue[head++]!;
      for (const d of DIRECTIONS) {
        const n = neighbor(cell, d, this.arena.width, this.arena.height);
        if (n < 0 || this.board[n] === -2 || this.seen[n] === this.searchId)
          continue;
        this.seen[n] = this.searchId;
        this.previous[n] = cell;
        if (this.board[n] === -1) {
          const path: number[] = [];
          for (
            let cursor = n;
            cursor !== start;
            cursor = this.previous[cursor]!
          )
            path.push(cursor);
          return path;
        }
        this.queue[tail++] = n;
      }
    }
    return null;
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
  private builtin(p: Player, legal: Direction[]): Direction {
    return chooseBuiltin(
      p.fallback ? { ...p, strategy: "straight" } : p,
      legal,
      this.board,
      this.arena,
      this.playerRng[p.id]!,
    );
  }

  private prepare(): Map<number, Direction[]> {
    this.step++;
    this.transitTargets.clear();
    const legal = new Map<number, Direction[]>();
    for (const p of this.players)
      if (!this.routes.has(p.id)) {
        const moves = legalMoves(p, this.board, this.arena);
        if (moves.length) legal.set(p.id, moves);
      }
    if (!legal.size && !this.routes.size) {
      for (const p of this.players) {
        const route = this.routeToFree(p.position);
        if (route) {
          this.routes.set(p.id, route);
          this.freshRoutes.add(p.id);
        }
      }
      if (!this.routes.size)
        throw new Error(
          "Die Arenamaske enthält unerreichbare, getrennte Bereiche. Ohne Teleportieren sind diese nicht vollständig begehbar.",
        );
    }
    for (const [id, route] of this.routes)
      this.transitTargets.set(id, route[route.length - 1]!);
    return legal;
  }

  private directionTo(from: number, to: number): Direction {
    return DIRECTIONS.find(
      (d) => neighbor(from, d, this.arena.width, this.arena.height) === to,
    )!;
  }

  private moveTransit(p: Player, target: number, conquer: boolean) {
    const route = this.routes.get(p.id)!;
    const first = this.freshRoutes.delete(p.id);
    if (first) p.restarts++;
    p.direction = this.directionTo(p.position, target);
    p.position = target;
    route.pop();
    const end = conquer || !route.length;
    if (conquer) {
      p.score++;
      this.claim(target, p.id);
    } else {
      p.returnSteps++;
      this.events.push(
        ((target << 2) |
          p.id |
          TRANSIT_FLAG |
          (first ? RETURN_START_FLAG : 0) |
          (end ? RETURN_END_FLAG : 0)) >>>
          0,
      );
    }
    if (end) {
      this.routes.delete(p.id);
      this.returned.add(p.id);
      p.lastRestartAt = this.step;
    }
  }

  private resolve(
    choices: Map<number, CustomAnswer>,
    legal: Map<number, Direction[]>,
  ) {
    const targets = new Map<number, Player[]>(),
      directions = new Map<number, Direction>();
    // Ordinary moves and free return targets compete on the unchanged pre-step board.
    for (const p of this.players) {
      let target = this.transitTargets.get(p.id);
      if (target !== undefined && this.board[target] !== -1) continue;
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
    // Transit over already occupied cells may cross other heads; ownership stays unchanged.
    for (const [id, target] of this.transitTargets)
      if (this.board[target] !== -1)
        this.moveTransit(this.players[id]!, target, false);
    for (const [target, contenders] of targets) {
      const p =
        contenders.length === 1
          ? contenders[0]!
          : contenders[Math.floor(this.rng() * contenders.length)]!;
      if (this.transitTargets.has(p.id)) this.moveTransit(p, target, true);
      else {
        p.position = target;
        p.direction = directions.get(p.id)!;
        p.score++;
        this.claim(target, p.id);
      }
    }
    this.offsets.push(this.events.length);
    this.finished = this.occupied === this.arena.playable;
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
                restarted: this.returned.has(p.id),
                returnSteps: p.returnSteps,
              });
            } catch (e) {
              choice = {
                error:
                  e instanceof Error ? e.message : "Ausführung fehlgeschlagen.",
              };
            }
            this.returned.delete(p.id);
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
