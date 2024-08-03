import type {
  SKStore,
  LazyCompute,
  EHandle,
  LHandle,
  Mapper,
  NonEmptyIterator,
  TJSON,
} from "skstore";

type CellKey = [string, string];

class ComputeExpression implements LazyCompute<CellKey, TJSON> {
  constructor(private skall: EHandle<CellKey, TJSON>) {}

  compute(selfHdl: LHandle<CellKey, TJSON>, key: CellKey): TJSON | null {
    const getComputed = (key: CellKey) => {
      const v = selfHdl.get(key);
      if (typeof v == "number") return v;
      if (typeof v == "string") {
        const nv = parseFloat(v);
        if (!isNaN(nv)) return nv;
      }
      throw new Error(
        `Invalid value for cell '${key[1]}' in sheet '${key[0]}'`,
      );
    };
    const sheet = key[0];
    const v = this.skall.maybeGet(key);
    if (v && typeof v == "string" && v.charAt(0) == "=") {
      try {
        // Fake evaluator in this exemple
        switch (v.substring(1)) {
          case "A1 + A2":
            const v1 = getComputed([sheet, "A1"]);
            const v2 = getComputed([sheet, "A2"]);
            return v1 + v2;
          case "A1 * A2":
            return getComputed([sheet, "A1"]) * getComputed([sheet, "A2"]);
          case "A3 - first!A3":
            const v1_3 = getComputed([sheet, "A3"]);
            const v2_3 = getComputed(["first", "A3"]);
            return v1_3 - v2_3;
          default:
            return "# Not managed expression.";
        }
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        return "# " + msg;
      }
    } else {
      return v;
    }
  }
}

class CallCompute implements Mapper<CellKey, TJSON, CellKey, TJSON> {
  constructor(private evaluator: LHandle<CellKey, TJSON>) {}

  mapElement(
    key: CellKey,
    it: NonEmptyIterator<TJSON>,
  ): Iterable<[CellKey, TJSON]> {
    const v = it.uniqueValue();
    if (typeof v == "string" && v.charAt(0) == "=") {
      return Array([key, this.evaluator.get(key)]);
    }
    if (v == null) {
      throw new Error("(sheet, cell) pair must be unique.");
    }
    return Array([key, v]);
  }
}

export function initSKStore(store: SKStore, cells: EHandle<CellKey, TJSON>) {
  // Use lazy dir to create eval dependency graph
  // Its calls it self to get other computed cells
  const evaluator = store.lazy<CellKey, TJSON, typeof ComputeExpression>(
    ComputeExpression,
    cells,
  );
  // Build a sub dependency graph for each sheet (For example purpose)
  // A parsing phase can be added to prevent expression parsing each time:
  // Parsing => Immutable ast
  // Evaluation => Compute tree with context
  return cells.map(CallCompute, evaluator);
}

export function scenarios() {
  return [
    [
      "watch-changes output",
      'insert input [[["first", "A1"], 23],[["first", "A2"], 2]]',
      'insert input [[["first", "A3"], "=A1 + A2"]]',
      'update input [["first", "A1"], 5]',
      "show output",
      'insert input [[["second", "A1"], 3],[["second", "A2"], 4]]',
      'insert input [[["second", "A3"], "=A1 * A2"]]',
      'insert input [[["second", "A4"], "=A3 - first!A3"]]',
      'update input [["second", "A1"], 1]',
      "show output",
      'delete input {"path":"[0]", "value":"first"}',
      "show output",
    ],
  ];
}
