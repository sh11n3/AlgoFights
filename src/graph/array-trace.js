// Tracks live algorithm arrays and copies them only at Graph Sim replay boundaries.
export function createArrayTrace(nodeCount, arcs) {
  const tracked = new Map();
  const frames = [];
  let started = false;
  const track = (dis, previous, side = 0) => {
    if (started)
      throw new Error(
        "graph.track muss vor dem ersten Suchschritt aufgerufen werden.",
      );
    if (
      (side !== 0 && side !== 1) ||
      (dis != null && dis.length !== nodeCount) ||
      (!(previous instanceof Map) && previous?.length !== nodeCount)
    ) {
      throw new Error(
        "graph.track erwartet ein Vorgängerarray und optional ein Distanzarray mit je einem Eintrag pro Knoten.",
      );
    }
    tracked.set(side, { dis, previous });
  };
  const capture = () => {
    started = true;
    if (!tracked.size) return;
    const frame = [];
    for (const [side, { dis, previous }] of tracked) {
      const pre = [],
        distances = dis == null ? undefined : [];
      for (let v = 0; v < nodeCount; v++) {
        if (distances) {
          const value = dis[v];
          if (!Number.isFinite(value) && value !== Infinity)
            throw new Error("Ungültige Distanz im aufgezeichneten Array.");
          distances.push(value);
        }
        const edge =
          previous instanceof Map ? (previous.get(v) ?? -1) : previous[v];
        if (edge === -1) pre.push(-1);
        else {
          const arc = arcs[edge];
          if (
            !Number.isInteger(edge) ||
            !arc ||
            (side ? arc.from : arc.to) !== v
          )
            throw new Error(
              "Ein aufgezeichneter Vorgänger muss eine passende Kanten-ID oder −1 sein.",
            );
          pre.push(side ? arc.to : arc.from);
        }
      }
      frame.push({ side, dis: distances, pre });
    }
    frames.push(frame);
  };
  return { track, capture, frames };
}
