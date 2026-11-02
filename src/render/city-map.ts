import { project } from "../routing/graph";
import type { RoadGraph, RouteResult } from "../routing/types";

export class CityMapRenderer {
  private base = document.createElement("canvas");
  private exploration = document.createElement("canvas");
  private drawn = 0;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private scale = 1;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private dirty = true;
  private result: RouteResult | null = null;
  private start = 0;
  private target = 0;
  private count = 0;
  private routeProgress = 0;
  constructor(
    private canvas: HTMLCanvasElement,
    readonly graph: RoadGraph,
  ) {}
  setEndpoints(start: number, target: number) {
    this.start = start;
    this.target = target;
    this.draw();
  }
  setResult(result: RouteResult | null) {
    this.result = result;
    this.drawn = 0;
    this.count = 0;
    this.routeProgress = 0;
    this.clearExploration();
    this.draw();
  }
  frame(count: number, routeProgress: number) {
    if (count < this.drawn) this.clearExploration();
    this.count = count;
    this.routeProgress = routeProgress;
    this.draw();
  }
  fit() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.invalidate();
  }
  pan(dx: number, dy: number) {
    this.panX += dx;
    this.panY += dy;
    this.invalidate();
  }
  zoomBy(factor: number, x = this.w / 2, y = this.h / 2) {
    const next = Math.max(0.7, Math.min(14, this.zoom * factor)),
      ratio = next / this.zoom;
    this.panX = (this.panX + this.w / 2 - x) * ratio + x - this.w / 2;
    this.panY = (this.panY + this.h / 2 - y) * ratio + y - this.h / 2;
    this.zoom = next;
    this.invalidate();
  }
  private invalidate() {
    this.dirty = true;
    this.clearExploration();
    this.draw();
  }
  private clearExploration() {
    this.exploration
      .getContext("2d")
      ?.clearRect(0, 0, this.exploration.width, this.exploration.height);
    this.drawn = 0;
  }
  private point(index: number): number[] {
    const n = this.graph.nodes[index]!;
    return this.world(n.x, n.y);
  }
  private world(x: number, y: number): number[] {
    return [
      this.w / 2 + this.panX + x * this.scale,
      this.h / 2 + this.panY + y * this.scale,
    ];
  }
  nearest(x: number, y: number): number | null {
    let best = -1,
      dist = 32 ** 2;
    this.graph.nodes.forEach((_, i) => {
      const p = this.point(i),
        d = (p[0]! - x) ** 2 + (p[1]! - y) ** 2;
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best < 0 ? null : best;
  }
  private line(ctx: CanvasRenderingContext2D, from: number, to: number) {
    const a = this.point(from),
      b = this.point(to);
    ctx.moveTo(a[0]!, a[1]!);
    ctx.lineTo(b[0]!, b[1]!);
  }
  private resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight,
      dpr = Math.min(devicePixelRatio || 1, 3);
    if (w <= 0 || h <= 0) return false;
    if (w !== this.w || h !== this.h || dpr !== this.dpr) {
      this.w = w;
      this.h = h;
      this.dpr = dpr;
      for (const c of [this.canvas, this.base, this.exploration]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      this.dirty = true;
      this.drawn = 0;
    }
    const b = this.graph.bbox,
      a = project(b[0]!, b[1]!, this.graph.center),
      z = project(b[2]!, b[3]!, this.graph.center);
    this.scale =
      Math.min(
        (w - 65) / Math.abs(z[0]! - a[0]!),
        (h - 90) / Math.abs(z[1]! - a[1]!),
      ) * this.zoom;
    return true;
  }
  private drawBase() {
    const c = this.base.getContext("2d")!;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#101316";
    c.fillRect(0, 0, this.w, this.h);
    for (const area of this.graph.areas) {
      c.beginPath();
      area.points.forEach((p, i) => {
        const [x, y] = this.world(p[0]!, p[1]!);
        if (i) c.lineTo(x!, y!);
        else c.moveTo(x!, y!);
      });
      c.closePath();
      c.fillStyle = area.kind === "water" ? "#273039" : "#171f1c";
      c.fill();
    }
    for (const major of [false, true]) {
      c.beginPath();
      for (const s of this.graph.segments) {
        const isMajor = /^(motorway|trunk|primary|secondary|tertiary)/.test(
          s.kind,
        );
        if (isMajor === major) this.line(c, s.a, s.b);
      }
      c.strokeStyle = major ? "#495057" : "#30383f";
      c.lineWidth = major ? 1.8 : 1;
      c.lineCap = "round";
      c.stroke();
    }
    // Label long street sections sparsely; names come directly from OSM.
    const used = new Set<string>(),
      cells = new Set<string>();
    c.font = "10px system-ui";
    c.textAlign = "center";
    for (const s of this.graph.segments) {
      if (!s.name || s.length * this.scale < 100 || used.has(s.name)) continue;
      const a = this.point(s.a),
        b = this.point(s.b),
        x = (a[0]! + b[0]!) / 2,
        y = (a[1]! + b[1]!) / 2,
        key = `${Math.floor(x / 120)},${Math.floor(y / 45)}`;
      if (
        x < 55 ||
        y < 95 ||
        x > this.w - 55 ||
        y > this.h - 55 ||
        cells.has(key)
      )
        continue;
      cells.add(key);
      used.add(s.name);
      c.lineWidth = 3;
      c.strokeStyle = "#101316";
      c.strokeText(s.name, x, y);
      c.fillStyle = "#88929b";
      c.fillText(s.name, x, y);
    }
    c.font = "500 13px system-ui";
    c.fillStyle = "#78858e";
    const labelCells=new Set<string>();
    for (const label of this.graph.labels) {
      if (this.zoom < 2.5 && label.name.length <= 4 && /\d/.test(label.name)) continue;
      const [x, y] = this.world(label.x, label.y);
      const cell=`${Math.floor(x!/100)},${Math.floor(y!/40)}`;
      if (x! > 45 && x! < this.w - 45 && y! > 120 && y! < this.h - 85 && !labelCells.has(cell)) {
        labelCells.add(cell);
        c.fillText(label.name, x!, y!);
      }
    }
    this.dirty = false;
  }
  draw() {
    if (!this.resize()) return;
    if (this.dirty) this.drawBase();
    const trace = this.exploration.getContext("2d")!;
    trace.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    trace.lineWidth = 2;
    trace.lineCap = "round";
    if (this.result) {
      for (
        let i = this.drawn;
        i < Math.min(this.count, this.result.traceNodes.length);
        i++
      ) {
        const edge = this.result.traceEdges[i]!;
        if (edge < 0) continue;
        const a = this.graph.arcs[edge]!;
        trace.beginPath();
        this.line(trace, a.from, a.to);
        trace.strokeStyle = this.result.traceSides[i] ? "#8d9dff" : "#37b3ef";
        trace.stroke();
      }
      this.drawn = this.count;
    }
    const c = this.canvas.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.base, 0, 0);
    c.drawImage(this.exploration, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.result?.found && this.routeProgress > 0) {
      let remaining = this.result.distance * this.routeProgress;
      c.beginPath();
      const first = this.point(this.start);
      c.moveTo(first[0]!, first[1]!);
      let tip = first;
      for (const edge of this.result.path) {
        const a = this.graph.arcs[edge]!,
          p = this.point(a.from),
          q = this.point(a.to),
          part = Math.min(1, remaining / a.length);
        tip = [p[0]! + (q[0]! - p[0]!) * part, p[1]! + (q[1]! - p[1]!) * part];
        c.lineTo(tip[0]!, tip[1]!);
        remaining -= a.length;
        if (remaining <= 0) break;
      }
      c.lineWidth = 4;
      c.strokeStyle = "#6bee87";
      c.lineCap = "round";
      c.lineJoin = "round";
      c.stroke();
      c.beginPath();
      c.arc(tip[0]!, tip[1]!, 3, 0, Math.PI * 2);
      c.fillStyle = "#e5ffe8";
      c.fill();
    }
    for (const [index, color, label] of [
      [this.start, "#6bee87", "S"],
      [this.target, "#ff746e", "Z"],
    ] as const) {
      const [x, y] = this.point(index);
      c.beginPath();
      c.arc(x!, y!, 7, 0, Math.PI * 2);
      c.fillStyle = "#101316";
      c.fill();
      c.beginPath();
      c.arc(x!, y!, 5, 0, Math.PI * 2);
      c.fillStyle = color;
      c.fill();
      c.font = "600 11px system-ui";
      c.textAlign = "center";
      c.fillStyle = color;
      c.fillText(label, x!, y! - 13);
    }
    const meters =
      [50, 100, 200, 500, 1000, 2000].find((n) => n * this.scale >= 55) ?? 2000;
    c.strokeStyle = "#8b969e";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(18, this.h - 64);
    c.lineTo(18 + meters * this.scale, this.h - 64);
    c.stroke();
    c.textAlign = "left";
    c.fillStyle = "#a0aab2";
    c.font = "10px system-ui";
    c.fillText(
      meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
      18,
      this.h - 72,
    );
    c.textAlign = "right";
    c.fillStyle = "#89949c";
    c.font = "11px system-ui";
    c.fillText("N ↑", this.w - 18, 104);
  }
}
