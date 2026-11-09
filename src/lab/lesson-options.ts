import type { LessonOptions } from "./types";

export function readLessonOptions(
  algorithm: string,
  value: unknown,
): LessonOptions | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Ungültige Verfahrensoptionen.");
  const options = value as Record<string, unknown>;
  const number = (key: string, min: number, max: number) => {
    const n = options[key];
    if (n === undefined) return;
    if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max)
      throw Error("Ungültiger Zahlenwert in den Verfahrensoptionen.");
    return n;
  };
  if (algorithm === "matrix-powers" && options.power !== undefined)
    return { power: number("power", 1, 32) };
  if (algorithm === "coloring" && options.colorCount !== undefined)
    return { colorCount: number("colorCount", 1, 8) };
  if (algorithm === "hamilton") {
    if (
      options.hamiltonCycle !== undefined &&
      typeof options.hamiltonCycle !== "boolean"
    )
      throw Error("Ungültige Hamilton-Suchart.");
    if (options.hamiltonCycle !== undefined)
      return { hamiltonCycle: options.hamiltonCycle as boolean };
  }
  if (algorithm === "anchor-match" && options.anchor !== undefined)
    return { anchor: number("anchor", 0, 47) };
  if (algorithm === "edit-metric") {
    if (
      options.third !== undefined &&
      (typeof options.third !== "string" || options.third.length > 48)
    )
      throw Error(
        "Die dritte Zeichenkette darf höchstens 48 Zeichen enthalten.",
      );
    if (options.third !== undefined) return { third: options.third as string };
  }
}
