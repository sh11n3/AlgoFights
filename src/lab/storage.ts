export interface OwnLesson {
  id: string;
  name: string;
  base: string;
  code: string;
  java: string;
  pseudocode: string;
  notation: string;
}
export function validOwn(value: unknown): value is OwnLesson {
  if (!value || typeof value !== "object") return false;
  const v = value as OwnLesson;
  return (
    typeof v.id === "string" &&
    /^lesson:[a-f0-9-]{36}$/.test(v.id) &&
    typeof v.base === "string" &&
    v.base.length < 80 &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    v.name.length <= 60 &&
    [v.code, v.java, v.pseudocode].every(
      (s) => typeof s === "string" && s.length <= 50000,
    ) &&
    typeof v.notation === "string" &&
    v.notation.length <= 4000
  );
}
export function readOwn(kind: string): OwnLesson[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(`algofights.lessons-${kind}.v1`) ?? "[]",
    );
    return Array.isArray(parsed) ? parsed.filter(validOwn).slice(0, 30) : [];
  } catch {
    return [];
  }
}
