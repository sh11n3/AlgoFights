import type { Replay } from "../core/types";

export interface FrameStats {
  scores: number[];
  positions: number[];
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
  constructor(
    private canvas: HTMLCanvasElement,
    readonly replay: Replay,
  ) {
    const { width, height } = replay.arena;
    this.buffer.width = width;
    this.buffer.height = height;
    this.pixels = new ImageData(width, height);
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
    this.reset();
  }
  private reset() {
    const { mask, width, height } = this.replay.arena;
    this.pixels.data.fill(0);
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
    this.positions = [...this.replay.starts];
  }
  seek(frame: number): FrameStats {
    frame = Math.max(0, Math.min(this.replay.steps, frame));
    if (frame < this.frame) this.reset();
    const end = this.replay.offsets[frame + 1]!;
    while (this.cursor < end) {
      const packed = this.replay.events[this.cursor++]!,
        cell = packed >>> 2,
        id = packed & 3;
      const color = this.colors[id]!;
      this.pixels.data.set([color[0]!, color[1]!, color[2]!, 255], cell * 4);
      this.scores[id] = this.scores[id]! + 1;
      this.positions[id] = cell;
    }
    this.frame = frame;
    this.buffer.getContext("2d")!.putImageData(this.pixels, 0, 0);
    this.draw();
    return {
      scores: [...this.scores],
      positions: [...this.positions],
      occupied: this.cursor,
    };
  }
  draw() {
    const context = this.canvas.getContext("2d")!;
    const size = this.canvas.clientWidth;
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
      const active = player.stoppedAt < 0 || this.frame < player.stoppedAt;
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
    });
  }
}
