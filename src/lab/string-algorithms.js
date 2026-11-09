export const levenshtein = function run(input, api) {
  const s = Array.from(input.s),
    t = Array.from(input.t),
    D = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0)),
    edits = [];
  const emit = (message, i = 0, j = 0, sources = []) =>
    api.emit(message, {
      matrices: [{ name: "D", values: D, active: [i, j], sources }],
      string: { i: i - 1, j: j - 1, edits },
    });
  for (let i = 0; i <= s.length; i++) D[i][0] = i;
  for (let j = 0; j <= t.length; j++) D[0][j] = j;
  emit(
    "Randwerte: Ein leeres Präfix benötigt genau so viele Einfügungen oder Löschungen wie das andere Zeichen enthält.",
  );
  for (let i = 1; i <= s.length; i++)
    for (let j = 1; j <= t.length; j++) {
      const same = s[i - 1] === t[j - 1];
      D[i][j] = Math.min(
        D[i - 1][j] + 1,
        D[i][j - 1] + 1,
        D[i - 1][j - 1] + (same ? 0 : 1),
      );
      emit(
        `D[${i}][${j}] = ${D[i][j]}: Minimum aus Löschen, Einfügen und ${same ? "unverändertem Zeichen" : "Ersetzen"}.`,
        i,
        j,
        [
          [i - 1, j],
          [i, j - 1],
          [i - 1, j - 1],
        ],
      );
    }
  let i = s.length,
    j = t.length;
  while (i || j) {
    if (
      i &&
      j &&
      D[i][j] === D[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1)
    ) {
      edits.unshift(
        s[i - 1] === t[j - 1]
          ? `Behalte „${s[i - 1]}“`
          : `Ersetze „${s[i - 1]}“ durch „${t[j - 1]}“`,
      );
      i--;
      j--;
    } else if (i && D[i][j] === D[i - 1][j] + 1) {
      edits.unshift(`Lösche „${s[i - 1]}“`);
      i--;
    } else {
      edits.unshift(`Füge „${t[j - 1]}“ ein`);
      j--;
    }
    emit(
      "Rekonstruktion: Der gewählte Nachbar erklärt eine optimale Editierentscheidung.",
      i,
      j,
    );
  }
  return `Editierdistanz d(s,t) = ${D[s.length][t.length]}. Eine optimale Folge: ${edits.join("; ") || "keine Operation"}.`;
};

export const levenshteinRecursive = function run(input, api) {
  const s = Array.from(input.s),
    t = Array.from(input.t),
    stack = [],
    cache = new Map();
  let calls = 0;
  if (s.length + t.length > 12)
    throw Error(
      "Für die naive Rekursion insgesamt höchstens 12 Zeichen verwenden. Die DP-Variante erlaubt längere Texte.",
    );
  function d(i, j) {
    calls++;
    stack.push(`${i},${j}`);
    api.emit(
      `Aufruf d(s[:${i}], t[:${j}]).${cache.has(i + "," + j) ? " Dieses Teilproblem wurde schon einmal berechnet." : ""}`,
      {
        arrays: [
          { name: "Aufrufstack · Präfixlängen", values: stack },
          { name: "Aufrufe", values: [calls] },
        ],
        string: { i: i - 1, j: j - 1 },
      },
    );
    let value;
    if (i === 0) value = j;
    else if (j === 0) value = i;
    else
      value = Math.min(
        d(i - 1, j) + 1,
        d(i, j - 1) + 1,
        d(i - 1, j - 1) + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    cache.set(i + "," + j, value);
    stack.pop();
    api.emit(`Rückgabe für (${i},${j}): ${value}.`, {
      arrays: [
        { name: "Aufrufstack · Präfixlängen", values: stack },
        { name: "Aufrufe", values: [calls] },
      ],
      string: { i: i - 1, j: j - 1 },
    });
    return value;
  }
  const result = d(s.length, t.length);
  return `d(s,t) = ${result}; ${calls} rekursive Aufrufe. Gleiche Teilprobleme wurden absichtlich mehrfach berechnet. Vergleiche die DP-Variante.`;
};

export const substring = function run(input, api) {
  const s = Array.from(input.s),
    t = Array.from(input.t),
    D = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0));
  let best = 0,
    end = 0;
  api.emit(
    "D[i][j] misst das gemeinsame Suffix der beiden Präfixe; Randwerte sind 0.",
    { matrices: [{ name: "D", values: D }] },
  );
  for (let i = 1; i <= s.length; i++)
    for (let j = 1; j <= t.length; j++) {
      D[i][j] = s[i - 1] === t[j - 1] ? D[i - 1][j - 1] + 1 : 0;
      if (D[i][j] > best) {
        best = D[i][j];
        end = i;
      }
      api.emit(
        s[i - 1] === t[j - 1]
          ? "Gleiche Zeichen verlängern das gemeinsame Suffix um eins."
          : "Verschiedene Zeichen unterbrechen die zusammenhängende Übereinstimmung: Wert 0.",
        {
          matrices: [
            { name: "D", values: D, active: [i, j], sources: [[i - 1, j - 1]] },
          ],
          arrays: [{ name: "Beste Länge", values: [best] }],
          string: {
            i: i - 1,
            j: j - 1,
            result: s.slice(end - best, end).join(""),
          },
        },
      );
    }
  return `Längste gemeinsame Teilzeichenkette: „${s.slice(end - best, end).join("")}“, Länge ${best}. Maßgeblich ist das Maximum der gesamten Tabelle.`;
};

export const substringNaive = function run(input, api) {
  const s = Array.from(input.s),
    t = Array.from(input.t);
  let comparisons = 0;
  for (let length = Math.min(s.length, t.length); length > 0; length--)
    for (let i = 0; i + length <= s.length; i++)
      for (let j = 0; j + length <= t.length; j++) {
        let k = 0;
        while (k < length) {
          comparisons++;
          const same = s[i + k] === t[j + k];
          api.emit(
            `Teilzeichenketten der Länge ${length}: Zeichenvergleich ${comparisons} ${same ? "stimmt überein" : "weicht ab"}.`,
            {
              arrays: [
                { name: "Länge", values: [length] },
                { name: "Vergleiche", values: [comparisons] },
              ],
              string: { i: i + k, j: j + k, length },
            },
          );
          if (!same) break;
          k++;
        }
        if (k === length)
          return `Längste gemeinsame Teilzeichenkette: „${s.slice(i, i + length).join("")}“, Länge ${length}; ${comparisons} Zeichenvergleiche.`;
      }
  return `Keine nichtleere gemeinsame Teilzeichenkette. ${comparisons} Zeichenvergleiche.`;
};

export const subsequence = function run(input, api) {
  const s = Array.from(input.s),
    t = Array.from(input.t),
    D = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0)),
    marks = [];
  let result = "";
  const emit = (message, i, j, sources = []) =>
    api.emit(message, {
      matrices: [{ name: "D", values: D, active: [i, j], sources }],
      string: { i: i - 1, j: j - 1, result, marks },
    });
  emit("Leere Präfixe besitzen eine gemeinsame Teilfolge der Länge 0.", 0, 0);
  for (let i = 1; i <= s.length; i++)
    for (let j = 1; j <= t.length; j++) {
      const same = s[i - 1] === t[j - 1];
      D[i][j] = same ? D[i - 1][j - 1] + 1 : Math.max(D[i - 1][j], D[i][j - 1]);
      emit(
        same
          ? "Gleiche letzte Zeichen erweitern eine gemeinsame Teilfolge."
          : "Ein letztes Zeichen auslassen: Das größere der beiden Nachbarprobleme wählen.",
        i,
        j,
        same
          ? [[i - 1, j - 1]]
          : [
              [i - 1, j],
              [i, j - 1],
            ],
      );
    }
  let i = s.length,
    j = t.length;
  while (i && j) {
    if (s[i - 1] === t[j - 1]) {
      result = s[i - 1] + result;
      marks.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (D[i - 1][j] >= D[i][j - 1]) i--;
    else j--;
    emit(
      "Rekonstruktion: Diagonale Schritte mit gleichen Zeichen liefern die Teilfolge.",
      i,
      j,
    );
  }
  return `Längste gemeinsame Teilfolge: „${result}“, Länge ${D[s.length][t.length]}. Die Zeichen müssen in derselben Reihenfolge, aber nicht direkt nebeneinander stehen.`;
};

export const naiveMatch = function run(input, api) {
  const p = Array.from(input.s),
    t = Array.from(input.t);
  let comparisons = 0;
  if (!p.length) {
    api.emit("Das leere Muster passt an Position 0.");
    return "Erster Treffer an Index 0.";
  }
  for (let offset = 0; offset + p.length <= t.length; offset++) {
    let j = 0;
    while (j < p.length) {
      comparisons++;
      const same = p[j] === t[offset + j];
      api.emit(
        `Vergleich ${comparisons}: Muster[${j}] mit Text[${offset + j}] ${same ? "gleich" : "ungleich"}.`,
        {
          arrays: [{ name: "Vergleiche", values: [comparisons] }],
          string: { i: offset + j, j, offset, length: j },
        },
      );
      if (!same) break;
      j++;
    }
    if (j === p.length)
      return `Erster Treffer an Index ${offset}; ${comparisons} Zeichenvergleiche.`;
  }
  return `Kein Treffer (−1); ${comparisons} Zeichenvergleiche.`;
};

export const anchorMatch = function run(input, api) {
  const p = Array.from(input.s),
    t = Array.from(input.t);
  if (!p.length) {
    api.emit("Ein leeres Muster passt an Position 0.", {
      string: { offset: 0 },
    });
    return "Treffer an Position 0.";
  }
  const counts = new Map();
  for (const char of t) counts.set(char, (counts.get(char) ?? 0) + 1);
  const frequency = p.map((char) => counts.get(char) ?? 0);
  let anchor = input.options?.anchor;
  if (anchor === undefined) anchor = frequency.indexOf(Math.min(...frequency));
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= p.length)
    throw Error("Die Ankerposition muss im Muster liegen.");
  const emit = (message, string) =>
    api.emit(message, {
      string,
      arrays: [
        { name: "Häufigkeit im Text", values: frequency, axis: "position" },
      ],
    });
  emit(
    `Musterposition ${anchor} („${p[anchor]}“) ist der Anker. Nur passende Textzeichen kommen als Anker infrage.`,
    { j: anchor },
  );
  for (let i = anchor; i + (p.length - 1 - anchor) < t.length; i++) {
    const offset = i - anchor;
    emit(`Textposition ${i} am Anker prüfen.`, { i, j: anchor, offset });
    if (t[i] !== p[anchor]) continue;
    let matches = true;
    for (let j = anchor - 1; j >= 0; j--) {
      emit("Links vom Anker vergleichen.", { i: offset + j, j, offset });
      if (t[offset + j] !== p[j]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    for (let j = anchor + 1; j < p.length; j++) {
      emit("Rechts vom Anker vergleichen.", { i: offset + j, j, offset });
      if (t[offset + j] !== p[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      emit(`Treffer an Textposition ${offset}.`, { offset, result: input.s });
      return `Treffer an Position ${offset}.`;
    }
  }
  return "Kein Treffer (−1).";
};

export const editMetric = function run(input, api) {
  const r = Array.from(input.options?.third ?? "saat"),
    s = Array.from(input.s),
    t = Array.from(input.t);
  function distance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++)
        row[j] = Math.min(
          previous[j] + 1,
          row[j - 1] + 1,
          previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
        );
      previous = row;
    }
    return previous[b.length];
  }
  const rs = distance(r, s),
    st = distance(s, t),
    rt = distance(r, t);
  const low = Math.abs(s.length - t.length),
    high = Math.max(s.length, t.length);
  api.emit(
    "Jede Einfügung und Löschung verändert die Länge um genau eins. Eine Ersetzung ändert sie nicht.",
    {
      arrays: [
        {
          name: "|s| · |t| · untere Schranke",
          values: [s.length, t.length, low],
        },
      ],
    },
  );
  api.emit(
    "Die gemeinsamen Positionen lassen sich ersetzen; danach genügt Einfügen oder Löschen des Überhangs.",
    {
      arrays: [
        {
          name: "untere Schranke · d(s,t) · obere Schranke",
          values: [low, st, high],
        },
      ],
    },
  );
  api.emit(
    `Die Umwandlungen r → s und s → t lassen sich verketten. Ihr Aufwand ist ${rs + st}, also mindestens d(r,t) = ${rt}.`,
    { arrays: [{ name: "d(r,s) · d(s,t) · d(r,t)", values: [rs, st, rt] }] },
  );
  return `Für diese Eingaben: ${low} ≤ d(s,t) = ${st} ≤ ${high} und d(r,t) = ${rt} ≤ ${rs} + ${st}.`;
};

export const kmp = function run(input, api) {
  const p = Array.from(input.s),
    t = Array.from(input.t),
    shift = Array(p.length + 1).fill(0);
  shift[0] = -1;
  let i = 0,
    j = -1,
    comparisons = 0;
  const emit = (text, state = {}) =>
    api.emit(text, {
      arrays: [
        { name: "s · Verschiebungstabelle", values: shift },
        { name: "Vergleiche im Text", values: [comparisons] },
      ],
      ...state,
    });
  emit(
    "Vorbereitung: s[0] = −1. Weitere Werte beschreiben nutzbare Präfix-Suffix-Übereinstimmungen.",
  );
  while (i < p.length) {
    while (j >= 0 && p[i] !== p[j]) {
      emit(
        `Mustervergleich fehlgeschlagen: von j=${j} auf s[j]=${shift[j]} zurückfallen.`,
        { string: { i, j, phase: "pattern" } },
      );
      j = shift[j];
    }
    i++;
    j++;
    shift[i] = j;
    emit(
      `s[${i}] = ${j}: längstes echtes Präfix, das auch Suffix des betrachteten Musterpräfixes ist.`,
      { string: { i: i - 1, j: j - 1, phase: "pattern" } },
    );
  }
  i = 0;
  j = 0;
  while (i < t.length && j < p.length) {
    while (j >= 0) {
      comparisons++;
      const same = t[i] === p[j];
      emit(`Text[${i}] und Muster[${j}] ${same ? "gleich" : "ungleich"}.`, {
        string: { i, j, offset: i - j, length: j },
      });
      if (same) break;
      j = shift[j];
      emit(`Sicherer Rücksprung: j=${j}; die Textposition i bleibt ${i}.`, {
        string: { i, j, offset: i - Math.max(0, j), length: Math.max(0, j) },
      });
    }
    i++;
    j++;
  }
  const found = j === p.length ? i - j : -1;
  emit(
    found >= 0
      ? `Treffer ab Index ${found}.`
      : "Textende ohne vollständiges Muster.",
    {
      string: {
        i: Math.min(i, t.length - 1),
        j: j - 1,
        offset: found >= 0 ? found : i - j,
        length: j,
      },
    },
  );
  return `${found >= 0 ? "Erster Treffer an Index " + found : "Kein Treffer (−1)"}; ${comparisons} Zeichenvergleiche im Text. Vorverarbeitung und Suche zusammen sind linear in Muster- plus Textlänge.`;
};
