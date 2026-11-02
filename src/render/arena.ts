import {
  eventCell,
  TRANSIT_FLAG,
  RETURN_START_FLAG,
  RETURN_END_FLAG,
  type Replay,
} from "../core/types";

export interface FrameStats {
  scores: number[];
  positions: number[];
  restarts: number[];
  blocked: boolean[];
  traveling: boolean[];
  returnSteps: number[];
  occupied: number;
}
export class ArenaRenderer {
  private buffer = document.createElement("canvas");
  private pixels: ImageData;
  private colors: number[][];
  private sprites: HTMLCanvasElement[];
  private cursor = 0;
  private frame = -1;
  private scores: number[];
  private positions: number[];
  private owners: Int8Array;
  private restarts: number[];
  private traveling: boolean[];
  private returnSteps: number[];
  constructor(
    private canvas: HTMLCanvasElement,
    readonly replay: Replay,
  ) {
    const { width, height } = replay.arena;
    this.buffer.width = width;
    this.buffer.height = height;
    this.pixels = new ImageData(width, height);
    this.owners = new Int8Array(width * height).fill(-1);
    this.colors = replay.players.map((p) =>
      p.color.match(/[0-9a-f]{2}/gi)!.map((c) => parseInt(c, 16)),
    );
    this.sprites = replay.players.map((p) => {
      const sprite = document.createElement("canvas");
      sprite.width = 64;
      sprite.height = 64;
      const context = sprite.getContext("2d")!,
        gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, p.color + "b0");
      gradient.addColorStop(0.25, p.color + "65");
      gradient.addColorStop(1, p.color + "00");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
      return sprite;
    });
    this.scores = replay.players.map(() => 0);
    this.positions = [...replay.starts];
    this.restarts = replay.players.map(() => 0);
    this.traveling = replay.players.map(() => false);
    this.returnSteps = replay.players.map(() => 0);
    this.reset();
  }
  private reset() {
    const { mask, width, height } = this.replay.arena;
    this.pixels.data.fill(0);
    this.owners.fill(-1);
    for (let i = 0; i < mask.length; i++)
      if (mask[i]) {
        const x = i % width,
          y = Math.floor(i / width);
        const edge =
          x === 0 ||
          y === 0 ||
          x === width - 1 ||
          y === height - 1 ||
          !mask[i - 1] ||
          !mask[i + 1] ||
          !mask[i - width] ||
          !mask[i + width];
        const offset = i * 4;
        this.pixels.data.set(
          edge ? [55, 68, 82, 255] : [22, 30, 41, 255],
          offset,
        );
      }
    this.cursor = 0;
    this.frame = -1;
    this.scores.fill(0);
    this.restarts.fill(0);
    this.traveling.fill(false);
    this.returnSteps.fill(0);
    this.positions = [...this.replay.starts];
  }
  seek(frame: number): FrameStats {
    frame = Math.max(0, Math.min(this.replay.steps, frame));
    if (frame < this.frame) this.reset();
    const end = this.replay.offsets[frame + 1]!;
    while (this.cursor < end) {
      const packed = this.replay.events[this.cursor++]!,
        cell = eventCell(packed),
        id = packed & 3;
      this.positions[id] = cell;
      if (packed & TRANSIT_FLAG) {
        this.returnSteps[id] = this.returnSteps[id]! + 1;
        if (packed & RETURN_START_FLAG)
          this.restarts[id] = this.restarts[id]! + 1;
        this.traveling[id] = !(packed & RETURN_END_FLAG);
        continue;
      }
      this.traveling[id] = false;
      const color = this.colors[id]!;
      this.owners[cell] = id;
      // A one-cell colored shoulder emphasizes narrow paths visually.
      // It never paints over another owner's cells or changes the simulation.
      const { width, height, mask } = this.replay.arena;
      const cx = cell % width,
        cy = Math.floor(cell / width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx,
            y = cy + dy,
            n = y * width + x;
          if (
            x < 0 ||
            y < 0 ||
            x >= width ||
            y >= height ||
            !mask[n] ||
            this.owners[n] !== -1
          )
            continue;
          const strength = dx && dy ? 0.18 : 0.38;
          this.pixels.data.set(
            [
              Math.round(22 + (color[0]! - 22) * strength),
              Math.round(30 + (color[1]! - 30) * strength),
              Math.round(41 + (color[2]! - 41) * strength),
              255,
            ],
            n * 4,
          );
        }
      this.pixels.data.set([color[0]!, color[1]!, color[2]!, 255], cell * 4);
      this.scores[id] = this.scores[id]! + 1;
    }
    this.frame = frame;
    this.buffer.getContext("2d")!.putImageData(this.pixels, 0, 0);
    this.draw();
    return {
      scores: [...this.scores],
      positions: [...this.positions],
      restarts: [...this.restarts],
      traveling: [...this.traveling],
      returnSteps: [...this.returnSteps],
      blocked: this.positions.map((position) => this.isBlocked(position)),
      occupied: this.scores.reduce((sum, score) => sum + score, 0),
    };
  }
  private isBlocked(position: number): boolean {
    const { width, height, mask } = this.replay.arena;
    const x = position % width,
      y = Math.floor(position / width);
    return ![
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ].some(
      ([nx, ny]) =>
        nx! >= 0 &&
        ny! >= 0 &&
        nx! < width &&
        ny! < height &&
        mask[ny! * width + nx!] &&
        this.owners[ny! * width + nx!] === -1,
    );
  }
  draw() {
    const context = this.canvas.getContext("2d")!;
    const size = this.canvas.clientWidth;
    if (size <= 0) return;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const physical = Math.round(size * dpr);
    if (this.canvas.width !== physical || this.canvas.height !== physical) {
      this.canvas.width = physical;
      this.canvas.height = physical;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);
    const padding = size * 0.042,
      inner = size - padding * 2;
    context.imageSmoothingEnabled = false;
    context.drawImage(this.buffer, padding, padding, inner, inner);
    this.positions.forEach((position, id) => {
      const player = this.replay.players[id]!;
      const active =
        (this.traveling[id] || !this.isBlocked(position)) &&
        (player.stoppedAt < 0 || this.frame < player.stoppedAt);
      const x =
        padding +
        (((position % this.replay.arena.width) + 0.5) /
          this.replay.arena.width) *
          inner;
      const y =
        padding +
        ((Math.floor(position / this.replay.arena.width) + 0.5) /
          this.replay.arena.height) *
          inner;
      if (active) {
        context.imageSmoothingEnabled = true;
        context.drawImage(this.sprites[id]!, x - 16, y - 16, 32, 32);
      }
      context.beginPath();
      context.arc(x, y, active ? 2.6 : 1.7, 0, Math.PI * 2);
      context.fillStyle = active ? "#f7ffff" : player.color;
      context.fill();
      if (active && this.traveling[id]) {
        context.beginPath();
        context.arc(x, y, 5, 0, Math.PI * 2);
        context.setLineDash([2, 2]);
        context.strokeStyle = player.color;
        context.lineWidth = 1;
        context.stroke();
        context.setLineDash([]);
      }
    });
  }
}
