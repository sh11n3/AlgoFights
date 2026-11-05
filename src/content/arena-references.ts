const turn = (java: string, order: string) => ({
  java: `    return firstTurn(s, ${java});`,
  pseudocode: `GIB den ersten freien Zug in dieser Reihenfolge ZURÜCK:\n    ${order}`,
  helper: "firstTurn" as const,
});

function reachability(example: boolean) {
  const limit = example ? 28 : 40;
  return {
    java: `    Direction best = null;
    double bestValue = Double.NEGATIVE_INFINITY;
    for (var move : s.availableMoves()) {
      var start = neighbor(new Point(s.x(), s.y()), move);
      var queue = new ArrayDeque<Point>();
      var seen = new HashSet<Point>();
      queue.add(start);
      seen.add(start);${example ? "" : "\n      int degree = 0;"}
      while (!queue.isEmpty() && seen.size() < ${limit}) {
        var cell = queue.removeFirst();
        for (var direction : DIRECTIONS) {
          var next = neighbor(cell, direction);
          if (cell(s, next) == -1 && seen.add(next)) {
            queue.addLast(next);${example ? "" : "\n            if (cell.equals(start)) degree++;"}
          }
          if (seen.size() == ${limit}) break;
        }
      }
      double value = seen.size() * 10${example ? "" : " + degree * 2"}
          + (move == s.facing() ? ${example ? "0.5" : "1"} : 0) + s.random().getAsDouble() * 0.1;
      if (value > bestValue) { best = move; bestValue = value; }
    }
    return best;`,
    pseudocode: `FÜR JEDEN erlaubten Zug
    zelle ← erreichte Nachbarzelle
    erkunde per Breitensuche höchstens ${limit} freie Zellen ab zelle
    wert ← 10 × Anzahl erkundeter Zellen${example ? "" : " + 2 × freie Nachbarn von zelle"}
    WENN der Zug geradeaus geht: addiere ${example ? "0,5" : "1"} zu wert
    addiere Seed-Zufall × 0,1 zu wert
GIB den ersten Zug mit maximalem wert ZURÜCK`,
    helper: "grid" as const,
  };
}

function boundarySearch(invasion: boolean) {
  return {
    java: `    Direction best = null;
    double bestValue = Double.NEGATIVE_INFINITY;
    for (var move : s.availableMoves()) {
      var candidate = neighbor(new Point(s.x(), s.y()), move);
      int boundary = 0;${invasion ? "\n      double opponents = 0;" : ""}
      for (var direction : DIRECTIONS) {
        int owner = cell(s, neighbor(candidate, direction));
        if (owner != -1) boundary++;${invasion ? "\n        if (owner >= 0 && owner != s.id()) opponents++;" : ""}
      }${
        invasion
          ? `
      for (var direction : DIRECTIONS) {
        var point = candidate;
        for (int distance = 1; distance <= 12; distance++) {
          point = neighbor(point, direction);
          int owner = cell(s, point);
          if (owner == -2) break;
          if (owner >= 0 && owner != s.id()) {
            opponents += (13 - distance) / 12.0;
            break;
          }
        }
      }`
          : ""
      }
      double value = ${invasion ? "20 * opponents - boundary" : "10 * boundary"}
          + (move == s.facing() ? ${invasion ? "0.5" : "1"} : 0) + s.random().getAsDouble() * 0.1;
      if (value > bestValue) { best = move; bestValue = value; }
    }
    return best;`,
    pseudocode: `FÜR JEDEN erlaubten Zug
    zelle ← erreichte Nachbarzelle
    grenze ← Anzahl ihrer vier gesperrten Nachbarn${
      invasion
        ? `
    gegner ← Anzahl direkt angrenzender gegnerischer Zellen
    FÜR JEDE Himmelsrichtung ab zelle
        untersuche höchstens 12 Zellen; stoppe an Wänden
        bei der ersten gegnerischen Zelle: addiere (13 − Entfernung) / 12 zu gegner
    wert ← 20 × gegner − grenze`
        : "\n    wert ← 10 × grenze"
    }
    WENN der Zug geradeaus geht: addiere ${invasion ? "0,5" : "1"} zu wert
    addiere Seed-Zufall × 0,1 zu wert
GIB den ersten Zug mit maximalem wert ZURÜCK`,
    helper: "grid" as const,
  };
}

const random = `    var moves = s.availableMoves();
    if (moves.isEmpty()) return null;
    return moves.get((int) (s.random().getAsDouble() * moves.size()));`;
const randomPseudo = `züge ← freie Nachbarn in vorgegebener Reihenfolge
index ← ABRUNDEN(Seed-Zufall × Anzahl züge)
GIB züge[index] ZURÜCK`;

const strategies = {
  right: turn("1, 0, 3, 2", "rechts, geradeaus, links, zurück"),
  left: turn("3, 0, 1, 2", "links, geradeaus, rechts, zurück"),
  straight: turn("0, 1, 3, 2", "geradeaus, rechts, links, zurück"),
  zigzag: {
    java: `    boolean odd = s.score() % 2 != 0;
    return firstTurn(s, odd ? 1 : 3, 0, odd ? 3 : 1, 2);`,
    pseudocode: `WENN Punktestand ungerade: prüfe rechts, geradeaus, links, zurück
SONST: prüfe links, geradeaus, rechts, zurück
GIB den ersten freien Zug ZURÜCK`,
    helper: "firstTurn",
  },
  serpentine: {
    java: `    boolean right = s.y() % 2 == s.id() % 2;
    var horizontal = right ? Direction.RIGHT : Direction.LEFT;
    var opposite = right ? Direction.LEFT : Direction.RIGHT;
    for (var move : List.of(horizontal, Direction.DOWN, Direction.UP, opposite)) {
      if (s.availableMoves().contains(move)) return move;
    }
    return null;`,
    pseudocode: `WENN Zeile und Teilnehmer-ID dieselbe Parität haben: waagrecht ← rechts
SONST: waagrecht ← links
GIB den ersten freien Zug ZURÜCK:\n    waagrecht, unten, oben, Gegenrichtung zu waagrecht`,
  },
  spiral: {
    java: `    int t = Math.max(0, s.score() - 1);
    int k = (int) ((Math.sqrt(4.0 * t + 1) - 1) / 2);
    int leg = 2 * k + (t - k * (k + 1) >= k + 1 ? 1 : 0);
    var preferred = DIRECTIONS[(s.id() + leg) % 4];
    return s.availableMoves().contains(preferred) ? preferred : firstTurn(s, 1, 0, 3, 2);`,
    pseudocode: `t ← MAX(0, Punktestand − 1)
Abschnitte haben die Längen 1, 1, 2, 2, 3, 3, …
Bestimme den nullbasierten Abschnitt, in den t fällt
richtung ← [oben, rechts, unten, links][(Teilnehmer-ID + Abschnitt) MOD 4]
WENN richtung frei ist: GIB richtung ZURÜCK
SONST: GIB den ersten freien Zug aus rechts, geradeaus, links, zurück ZURÜCK`,
    helper: "firstTurn",
  },
  random: { java: random, pseudocode: randomPseudo },
  lookahead: reachability(false),
  edge: boundarySearch(false),
  invasion: boundarySearch(true),
} as const;

const helpers = {
  firstTurn: `
  static Direction firstTurn(State s, int... turns) {
    for (int turn : turns) {
      var move = DIRECTIONS[(s.facing().ordinal() + turn) % 4];
      if (s.availableMoves().contains(move)) return move;
    }
    return null;
  }
`,
  grid: `
  record Point(int x, int y) {}

  static Point neighbor(Point p, Direction d) {
    return switch (d) {
      case UP -> new Point(p.x(), p.y() - 1);
      case RIGHT -> new Point(p.x() + 1, p.y());
      case DOWN -> new Point(p.x(), p.y() + 1);
      case LEFT -> new Point(p.x() - 1, p.y());
    };
  }

  static int cell(State s, Point p) {
    if (p.x() < 0 || p.x() >= s.width() || p.y() < 0 || p.y() >= s.height()) return -2;
    return s.board().applyAsInt(p.x(), p.y());
  }
`,
};

function reference(
  strategy: { java: string; pseudocode: string; helper?: keyof typeof helpers },
  memory?: { body: string; pseudocode: string },
) {
  const support = strategy.helper ? helpers[strategy.helper] : "";
  return {
    pseudocode: memory?.pseudocode ?? strategy.pseudocode,
    java: `import java.util.*;
import java.util.function.*;

class ArenaStrategy {
  enum Direction { UP, RIGHT, DOWN, LEFT }
${strategy.helper ? "  static final Direction[] DIRECTIONS = Direction.values();\n" : ""}
  // Raster: -2 = Wand, -1 = frei, ab 0 = Teilnehmer-ID.
  record State(int x, int y, int width, int height, int id, int score, Direction facing,
               List<Direction> availableMoves, DoubleSupplier random, IntBinaryOperator board,
               boolean afterReturn) {}
${
  memory
    ? `
  record Move(Direction direction, int counter) {}

  static Move nextMove(State s, int counter) {
${memory.body}
  }
`
    : ""
}
  static Direction ${memory ? "choose" : "nextMove"}(State s) {
${strategy.java}
  }
${support}}`,
  };
}

export function arenaReference(id: string) {
  return reference(strategies[id as keyof typeof strategies]);
}

export const EXAMPLE_REFERENCES = {
  random: reference(strategies.random, {
    body: "    return new Move(choose(s), counter + 1);",
    pseudocode: randomPseudo.replace(
      "GIB züge[index] ZURÜCK",
      "GIB züge[index] und den um 1 erhöhten Zugzähler ZURÜCK",
    ),
  }),
  right: reference(strategies.right),
  memory: reference(strategies.random, {
    body: `    if (s.afterReturn()) counter = 0;
    var direction = s.availableMoves().contains(s.facing()) ? s.facing() : choose(s);
    return new Move(direction, counter + 1);`,
    pseudocode: `WENN gerade ein Rücklauf endete: setze Entscheidungszähler auf 0
WENN geradeaus frei ist: zug ← geradeaus
SONST: zug ← Seed-Zufallsauswahl aus freien Nachbarn
GIB zug und den um 1 erhöhten Entscheidungszähler ZURÜCK`,
  }),
  room: reference(reachability(true)),
};
