import { schema, cjson as json } from "skstore";
import type {
  TableHandle,
  TJSON,
  SKStore,
  EHandle,
  TableMapper,
  OutputMapper,
  NonEmptyIterator,
} from "skstore";

export type Config = {
  name?: () => string;
  inputs?: () => string[];
  initSKStore: (
    store: SKStore,
    ...inputs: EHandle<TJSON, TJSON>[]
  ) => EHandle<TJSON, TJSON>;
  scenarios?: () => string[][];
};

class Identity<
  K1 extends TJSON,
  V1 extends TJSON,
  K2 extends TJSON,
  V2 extends TJSON,
> implements TableMapper<[K1, V1], K2, V2>
{
  mapElement: (entry: [K1, V1], occ: number) => Iterable<[K2, V2]> = (
    entry: [K1, V1],
    _occ: number,
  ) => {
    return Array([entry[0] as any as K2, entry[1] as any as V2]);
  };
}

class ToOutput<K extends TJSON, V extends TJSON>
  implements OutputMapper<[K, V], K, V>
{
  mapElement: (key: K, it: NonEmptyIterator<V>) => [K, V] = (
    key: K,
    it: NonEmptyIterator<V>,
  ) => {
    return [key, it.first()];
  };
}

export function build(config: Config) {
  return {
    tablesSchema: () => {
      const schemas = (config.inputs ? config.inputs() : ["input"]).map((i) =>
        schema(i, [json("key", true), json("value")]),
      );
      schemas.push(
        schema(config.name ? config.name() : "output", [
          json("key", true),
          json("value"),
        ]),
      );
      return schemas;
    },
    initSKStore: (store: SKStore, ...tables: TableHandle<[TJSON, TJSON]>[]) => {
      const inputs: EHandle<TJSON, TJSON>[] = [];
      for (let i = 0; i < tables.length - 1; i++) {
        inputs.push(tables[i].map(Identity));
      }
      const eoutput = config.initSKStore(store, ...inputs);
      eoutput.mapTo<[TJSON, TJSON], typeof ToOutput>(
        tables[tables.length - 1],
        ToOutput,
      );
    },
    scenarios: () => (config.scenarios ? config.scenarios() : []),
  };
}
