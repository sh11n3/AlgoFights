/* Runs only inside an opaque-origin sandbox worker. No access to the trusted engine. */
(() => {
  "use strict";
  self.onmessage = ({ data, ports }) => {
    const port = ports[0];
    const { width, height, mask, initial, code, seed, id } = data;
    const board = new Int8Array(mask.length);
    for (let i = 0; i < mask.length; i++) board[i] = mask[i] ? -1 : -2;
    for (const packed of initial) board[packed >>> 2] = packed & 3;
    let memory = {},
      stateSeed = seed >>> 0,
      decide;
    const rng = () => {
      stateSeed += 0x6d2b79f5;
      let t = Math.imul(stateSeed ^ (stateSeed >>> 15), 1 | stateSeed);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Capture communication before user code executes. It never receives this port.
    const send = port.postMessage.bind(port);
    const clone = structuredClone;
    const stringify = JSON.stringify;
    const directions = ["up", "right", "down", "left"];
    const offsets = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    try {
      decide = new Function(
        '"use strict";\n' +
          code +
          '\n;if (typeof nextMove !== "function") throw new Error("Definiere function nextMove(state, memory)."); return nextMove;',
      )();
      if (typeof decide !== "function")
        throw new Error("nextMove muss eine Funktion sein.");
    } catch (error) {
      send({
        ready: true,
        error: String(error.message || error).slice(0, 400),
      });
      return;
    }
    send({ ready: true });
    port.onmessage = ({ data: request }) => {
      try {
        for (const packed of request.delta) board[packed >>> 2] = packed & 3;
        let queries = 0;
        const cell = (x, y) => {
          if (++queries > 128)
            throw new Error(
              "Pro Zug sind höchstens 128 cell()-Abfragen erlaubt.",
            );
          if (
            !Number.isInteger(x) ||
            !Number.isInteger(y) ||
            x < 0 ||
            y < 0 ||
            x >= width ||
            y >= height
          )
            return "wall";
          const value = board[y * width + x];
          return value === -2
            ? "wall"
            : value === -1
              ? "free"
              : value === id
                ? "self"
                : "opponent";
        };
        const x = request.position % width,
          y = Math.floor(request.position / width);
        const neighbors = {};
        for (let n = 0; n < 4; n++) {
          const nx = x + offsets[n][0],
            ny = y + offsets[n][1],
            type = cell(nx, ny);
          neighbors[directions[n]] = Object.freeze({
            x: nx,
            y: ny,
            type,
            free: type === "free",
          });
        }
        queries = 0;
        const state = Object.freeze({
          x,
          y,
          position: Object.freeze({ x, y }),
          width,
          height,
          direction: request.direction,
          score: request.score,
          step: request.step,
          neighbors: Object.freeze(neighbors),
          availableMoves: Object.freeze(
            directions.filter((d) => neighbors[d].free),
          ),
          cell,
          random: rng,
        });
        const result = decide(state, memory);
        if (
          !result ||
          typeof result !== "object" ||
          !directions.includes(result.direction)
        ) {
          throw new Error(
            'Erwartet wird { direction: "up" | "right" | "down" | "left", memory }.',
          );
        }
        if (result.memory !== undefined) {
          const serialized = stringify(result.memory);
          if (serialized === undefined || serialized.length > 16384)
            throw new Error(
              "memory muss JSON-kompatibel und höchstens 16 KB groß sein.",
            );
          memory = clone(result.memory);
        }
        send({ direction: result.direction });
      } catch (error) {
        send({ error: String(error.message || error).slice(0, 400) });
      }
    };
    port.start();
  };
})();
