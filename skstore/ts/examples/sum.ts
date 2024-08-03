import type { SKStore, EHandle, NonEmptyIterator, Mapper } from "skstore";

class Add implements Mapper<number, number, number, number> {
  constructor(private other: EHandle<number, number>) {}

  mapElement(
    key: number,
    it: NonEmptyIterator<number>,
  ): Iterable<[number, number]> {
    const v = it.first();
    const ev = this.other.maybeGet(key);
    if (ev !== null) {
      return Array([key, v + (ev ?? 0)]);
    }
    return Array();
  }
}

export function inputs() {
  return ["input1", "input2"];
}

export function initSKStore(
  _store: SKStore,
  input1: EHandle<number, number>,
  input2: EHandle<number, number>,
) {
  return input1.map1(Add, input2);
}

export function scenarios() {
  return [
    [
      "watch output",
      "insert input1 [[1, 2]]",
      "insert input2 [[1, 3]]",
      'delete input1 {"value":1}',
      "insert input1 [[1, 4], [2,6]]",
      "insert input2 [[2, 0]]",
      "update input1 [1,8]",
      "show output",
    ],
  ];
}
