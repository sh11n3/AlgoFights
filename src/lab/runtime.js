// Shared recorder for the bundled worker and the opaque-origin editor worker.
export function executeLesson(input, source, limit = 2000) {
  const frames = [],
    stop = {};
  let limited = false,
    bytes = 0;
  const start = performance.now();
  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function emit(message, state = {}) {
    if (limited || frames.length >= limit + 1) {
      limited = true;
      throw stop;
    }
    if (typeof message !== "string" || message.length > 1200)
      throw Error(
        "Schritttext muss ein Text mit höchstens 1.200 Zeichen sein.",
      );
    const copy = structuredClone(state);
    if (!copy || typeof copy !== "object" || Array.isArray(copy))
      throw Error("Der Schrittzustand muss ein Objekt sein.");
    for (const key of ["current", "edge"]) {
      if (
        copy[key] !== undefined &&
        (!Number.isInteger(copy[key]) ||
          copy[key] < 0 ||
          copy[key] >=
            (key === "current" ? input.nodes.length : input.edges.length))
      )
        throw Error(`Ungültiger ${key}-Index im Schrittzustand.`);
    }
    const value = (v) =>
      v === null ||
      typeof v === "boolean" ||
      (typeof v === "string" && v.length <= 300) ||
      (typeof v === "number" && !Number.isNaN(v));
    for (const a of copy.arrays ?? []) {
      if (
        typeof a.name !== "string" ||
        a.name.length > 60 ||
        !Array.isArray(a.values) ||
        a.values.length > 128 ||
        !a.values.every(value)
      )
        throw Error("Arrays benötigen name und höchstens 128 einfache values.");
    }
    for (const m of copy.matrices ?? []) {
      if (
        typeof m.name !== "string" ||
        m.name.length > 60 ||
        !Array.isArray(m.values) ||
        m.values.length > 65 ||
        !m.values.every(
          (row) => Array.isArray(row) && row.length <= 65 && row.every(value),
        )
      )
        throw Error(
          "Eine Matrix darf höchstens 65 × 65 einfache Werte enthalten.",
        );
      const cell = (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((v) => Number.isInteger(v) && v >= 0 && v <= 64);
      if (
        (m.active !== undefined && !cell(m.active)) ||
        (m.sources !== undefined &&
          (!Array.isArray(m.sources) ||
            m.sources.length > 128 ||
            !m.sources.every(cell)))
      )
        throw Error(
          "Matrixpositionen benötigen [Zeile, Spalte] mit ganzzahligen Indizes.",
        );
    }
    for (const key of [
      "colors",
      "groups",
      "selected",
      "rejected",
      "queue",
      "stack",
      "order",
    ]) {
      if (
        copy[key] !== undefined &&
        (!Array.isArray(copy[key]) ||
          copy[key].length > 512 ||
          !copy[key].every(Number.isInteger))
      )
        throw Error(`Ungültiges Array ${key}.`);
    }
    if (
      copy.heap !== undefined &&
      (!Array.isArray(copy.heap) ||
        copy.heap.length > 512 ||
        !copy.heap.every(
          (row) =>
            Array.isArray(row) &&
            row.length === 2 &&
            row.every(Number.isFinite),
        ))
    )
      throw Error("heap erwartet Paare [Knoten, Priorität].");
    if (copy.transpose !== undefined && typeof copy.transpose !== "boolean")
      throw Error("transpose muss ein Wahrheitswert sein.");
    if (copy.string !== undefined) {
      const s = copy.string;
      if (!s || typeof s !== "object" || Array.isArray(s))
        throw Error("string muss ein Objekt mit Zeichenpositionen sein.");
      for (const key of ["i", "j", "offset", "length"])
        if (
          s[key] !== undefined &&
          (!Number.isInteger(s[key]) || s[key] < -1 || s[key] > 128)
        )
          throw Error("Ungültige Zeichenposition in string.");
      if (
        s.result !== undefined &&
        (typeof s.result !== "string" || s.result.length > 300)
      )
        throw Error("string.result muss ein kurzer Text sein.");
      if (s.phase !== undefined && s.phase !== "pattern")
        throw Error(
          "string.phase unterstützt nur pattern für den Muster-Selbstvergleich.",
        );
      if (
        s.edits !== undefined &&
        (!Array.isArray(s.edits) ||
          s.edits.length > 128 ||
          !s.edits.every((v) => typeof v === "string" && v.length <= 300))
      )
        throw Error("string.edits muss eine Liste kurzer Texte sein.");
      if (
        s.marks !== undefined &&
        (!Array.isArray(s.marks) ||
          s.marks.length > 128 ||
          !s.marks.every(
            (p) =>
              Array.isArray(p) &&
              p.length === 2 &&
              p.every((v) => Number.isInteger(v) && v >= 0 && v < 128),
          ))
      )
        throw Error("string.marks benötigt Paare von Zeichenpositionen.");
    }
    bytes += JSON.stringify(copy).length * 2 + message.length * 2;
    if (bytes > 24 * 1024 * 1024) {
      limited = true;
      throw stop;
    }
    frames.push({ message, state: copy });
  }
  let result = "";
  try {
    const run = new Function(
      '"use strict";\n' +
        source +
        '\n;if(typeof run!=="function") throw Error("Definiere function run(input, api)."); return run;',
    )();
    const output = run(
      freeze(input),
      Object.freeze({
        emit,
        label: (id) => input.nodes[id]?.label ?? String(id),
      }),
    );
    if (output && typeof output.then === "function")
      throw Error("run muss synchron arbeiten.");
    if (typeof output !== "string" || output.length > 8000)
      throw Error(
        "run muss einen Ergebnistext mit höchstens 8.000 Zeichen zurückgeben.",
      );
    result = output;
    if (!frames.length) emit("Ergebnis", {});
  } catch (error) {
    if (error !== stop) throw error;
  }
  return {
    frames,
    result: limited
      ? "Aufzeichnung am Schritt- oder Speicherlimit angehalten. Für einen vollständigen Lauf das Limit erhöhen oder kleinere Eingaben verwenden."
      : result,
    limited,
    milliseconds: performance.now() - start,
  };
}
