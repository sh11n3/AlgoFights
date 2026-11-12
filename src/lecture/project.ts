import { readExample, type Example } from "../sharing/examples";
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type SlideAppearance = "inline-light" | "inline-dark";
export interface LectureWidget {
  id: string;
  title: string;
  rect: Rectangle;
  example: Example;
  appearance?: SlideAppearance;
}
export interface PdfIdentity {
  name: string;
  size: number;
  pages: number;
  sha256: string;
}
export interface LectureProject {
  format: "algofights-lecture-v1";
  title: string;
  pdf: PdfIdentity | null;
  slides: Record<string, LectureWidget[]>;
}
export const PROJECT_KEY = "algofights.lecture.v1";
export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
export function newProject(): LectureProject {
  return {
    format: "algofights-lecture-v1",
    title: "Meine Vorlesung",
    pdf: null,
    slides: {},
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max;
export function readProject(value: unknown): LectureProject {
  if (
    !object(value) ||
    value.format !== "algofights-lecture-v1" ||
    !text(value.title, 80) ||
    !object(value.slides)
  )
    throw Error("Keine gültige AlgoFights-Vorlesung.");
  let pdf: PdfIdentity | null = null;
  if (value.pdf !== null) {
    const p = value.pdf;
    if (
      !object(p) ||
      !text(p.name, 200) ||
      typeof p.size !== "number" ||
      !Number.isInteger(p.size) ||
      p.size < 1 ||
      p.size > MAX_PDF_BYTES ||
      !Number.isInteger(p.pages) ||
      Number(p.pages) < 1 ||
      Number(p.pages) > 2000 ||
      typeof p.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(p.sha256)
    )
      throw Error("Ungültige PDF-Zuordnung im Projekt.");
    pdf = {
      name: p.name as string,
      size: p.size,
      pages: p.pages as number,
      sha256: p.sha256,
    };
  }
  const slides: Record<string, LectureWidget[]> = {},
    ids = new Set<string>();
  let count = 0;
  for (const [page, widgets] of Object.entries(value.slides)) {
    if (
      !pdf ||
      !/^\d{1,4}$/.test(page) ||
      String(Number(page)) !== page ||
      Number(page) < 1 ||
      Number(page) > pdf.pages ||
      !Array.isArray(widgets) ||
      widgets.length > 6
    )
      throw Error(
        "Ungültige Folie oder mehr als sechs Simulationen auf einer Folie.",
      );
    slides[page] = widgets.map((w: unknown) => {
      if (
        ++count > 200 ||
        !object(w) ||
        typeof w.id !== "string" ||
        !/^[a-f0-9-]{36}$/.test(w.id) ||
        ids.has(w.id) ||
        !text(w.title, 100) ||
        !object(w.rect)
      )
        throw Error("Ungültige Simulation oder mehr als 200 Einbettungen.");
      ids.add(w.id);
      const r = w.rect;
      if (
        ![r.x, r.y, r.width, r.height].every(
          (n) => typeof n === "number" && Number.isFinite(n),
        ) ||
        Number(r.x) < 0 ||
        Number(r.y) < 0 ||
        Number(r.width) < 0.15 ||
        Number(r.height) < 0.15 ||
        Number(r.x) + Number(r.width) > 1.00001 ||
        Number(r.y) + Number(r.height) > 1.00001
      )
        throw Error("Ungültiger Simulationsbereich.");
      return {
        id: w.id,
        title: w.title as string,
        rect: {
          x: r.x as number,
          y: r.y as number,
          width: r.width as number,
          height: r.height as number,
        },
        example: readExample(w.example),
        ...(w.appearance === "inline-light" || w.appearance === "inline-dark"
          ? { appearance: w.appearance }
          : {}),
      };
    });
  }
  return {
    format: "algofights-lecture-v1",
    title: value.title as string,
    pdf,
    slides,
  };
}
export function loadProject(): LectureProject {
  try {
    const json = localStorage.getItem(PROJECT_KEY) ?? "null";
    if (new TextEncoder().encode(json).length > MAX_PROJECT_BYTES)
      return newProject();
    return readProject(JSON.parse(json));
  } catch {
    return newProject();
  }
}
export function movedRectangle(
  original: Rectangle,
  dx: number,
  dy: number,
  resize = false,
): Rectangle {
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));
  return resize
    ? {
        ...original,
        width: clamp(original.width + dx, 0.15, 1 - original.x),
        height: clamp(original.height + dy, 0.15, 1 - original.y),
      }
    : {
        ...original,
        x: clamp(original.x + dx, 0, 1 - original.width),
        y: clamp(original.y + dy, 0, 1 - original.height),
      };
}
