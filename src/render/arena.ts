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
// Precomputed raster halos keep trails readable without a fullscreen blur pass.
const littleEndian =
  new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
function rgba(r: number, g: number, b: number): number {
  return (
    (littleEndian
      ? (255 << 24) | (b << 16) | (g << 8) | r
      : (r << 24) | (g << 16) | (b << 8) | 255) >>> 0
  );
}
const halo: Array<{ dx: number; dy: number; level: number }> = [];
for (let dy = -2; dy <= 2; dy++)
  for (let dx = -2; dx <= 2; dx++) {
    if (!dx && !dy) continue;
    const level =
      Math.max(Math.abs(dx), Math.abs(dy)) === 2
        ? dx && dy
          ? 0
          : 1
        : dx && dy
          ? 2
          : 3;
    halo.push({ dx, dy, level });
  }
const TILE = 64;

export class ArenaRenderer {
  private buffer = document.createElement("canvas");
  private pixels: ImageData;
  private colorPixels: number[];
  private haloPixels: number[][];
  private packedPixels: Uint32Array;
  private haloLevels: Uint8Array;
  private tileColumns: number;
  private dirtyFlags: Uint8Array;
  private dirtyTiles: number[] = [];
  private fullDirty = true;
  private context: CanvasRenderingContext2D;
  private bufferContext: CanvasRenderingContext2D;
  private blocked: boolean[];
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
    this.packedPixels = new Uint32Array(this.pixels.data.buffer);
    this.owners = new Int8Array(width * height).fill(-1);
    this.haloLevels = new Uint8Array(width * height);
    this.tileColumns = Math.ceil(width / TILE);
    this.dirtyFlags = new Uint8Array(
      this.tileColumns * Math.ceil(height / TILE),
    );
    this.context = canvas.getContext("2d")!;
    this.bufferContext = this.buffer.getContext("2d")!;
    this.blocked = replay.players.map(() => false);
    const colors = replay.players.map((p) =>
      p.color.match(/[0-9a-f]{2}/gi)!.map((c) => parseInt(c, 16)),
    );
    this.colorPixels = colors.map((c) => rgba(c[0]!, c[1]!, c[2]!));
    this.haloPixels = colors.map((c) =>
      [0.035, 0.09, 0.28, 0.55].map((strength) =>
        rgba(
          Math.round(22 + (c[0]! - 22) * strength),
          Math.round(30 + (c[1]! - 30) * strength),
          Math.round(41 + (c[2]! - 41) * strength),
        ),
      ),
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
    this.haloLevels.fill(0);
    this.dirtyFlags.fill(0);
    this.dirtyTiles.length = 0;
    this.fullDirty = true;
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
        this.packedPixels[i] = edge ? rgba(55, 68, 82) : rgba(22, 30, 41);
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
    frame = Math.max(0, Math.min(this.replay.steps, Math.floor(frame)));
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
      this.owners[cell] = id;
      const { width, height, mask } = this.replay.arena;
      const cx = cell % width,
        cy = Math.floor(cell / width);
      // Paint a narrow shoulder and a faint outer halo only into unclaimed cells.
      // A weak halo never overwrites an existing brighter shoulder.
      const palette = this.haloPixels[id]!;
      for (const { dx, dy, level } of halo) {
        const x = cx + dx,
          y = cy + dy,
          n = y * width + x;
        if (
          x < 0 ||
          y < 0 ||
          x >= width ||
          y >= height ||
          !mask[n] ||
          this.owners[n] !== -1 ||
          this.haloLevels[n]! >= level + 1
        )
          continue;
        this.haloLevels[n] = level + 1;
        this.packedPixels[n] = palette[level]!;
      }
      this.packedPixels[cell] = this.colorPixels[id]!;
      this.markDirty(cx, cy);
      this.scores[id] = this.scores[id]! + 1;
    }
    this.frame = frame;
    this.flushPixels();
    this.blocked = this.positions.map((position) => this.isBlocked(position));
    this.draw();
    return {
      scores: [...this.scores],
      positions: [...this.positions],
      restarts: [...this.restarts],
      traveling: [...this.traveling],
      returnSteps: [...this.returnSteps],
      blocked: [...this.blocked],
      occupied: this.scores.reduce((sum, score) => sum + score, 0),
    };
  }
  private isBlocked(position: number): boolean {
    const { width, height, mask } = this.replay.arena;
    const x = position % width,
      y = Math.floor(position / width);
    return !(
      (x > 0 && mask[position - 1] && this.owners[position - 1] === -1) ||
      (x < width - 1 &&
        mask[position + 1] &&
        this.owners[position + 1] === -1) ||
      (y > 0 &&
        mask[position - width] &&
        this.owners[position - width] === -1) ||
      (y < height - 1 &&
        mask[position + width] &&
        this.owners[position + width] === -1)
    );
  }
  private markDirty(x: number, y: number) {
    if (this.fullDirty) return;
    const { width, height } = this.replay.arena;
    const x0 = Math.max(0, x - 2) >> 6,
      x1 = Math.min(width - 1, x + 2) >> 6;
    const y0 = Math.max(0, y - 2) >> 6,
      y1 = Math.min(height - 1, y + 2) >> 6;
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const tile = ty * this.tileColumns + tx;
        if (!this.dirtyFlags[tile]) {
          this.dirtyFlags[tile] = 1;
          this.dirtyTiles.push(tile);
        }
      }
  }
  private flushPixels() {
    if (this.fullDirty) {
      this.bufferContext.putImageData(this.pixels, 0, 0);
      this.fullDirty = false;
    } else {
      const { width, height } = this.replay.arena;
      for (const tile of this.dirtyTiles) {
        const x = (tile % this.tileColumns) * TILE,
          y = Math.floor(tile / this.tileColumns) * TILE;
        this.bufferContext.putImageData(
          this.pixels,
          0,
          0,
          x,
          y,
          Math.min(TILE, width - x),
          Math.min(TILE, height - y),
        );
        this.dirtyFlags[tile] = 0;
      }
    }
    this.dirtyTiles.length = 0;
  }
  draw() {
    const context = this.context;
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
        (this.traveling[id] || !this.blocked[id]) &&
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
