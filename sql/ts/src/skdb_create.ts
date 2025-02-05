import { run, type ModuleInit } from "../skipwasm-std/index.js";
import type { SKDBShared } from "./skdb_types.js";
import { getWasmUrl } from "./skdb_wasm_locator.js";

export async function createOnThisThread(
  disableWarnings: boolean,
  modules: ModuleInit[],
  dbName?: string,
  getWasmSource?: () => Promise<Uint8Array>,
) {
  const data = await run(
    getWasmUrl,
    modules,
    [],
    "SKDB_factory",
    getWasmSource,
  );
  data.environment.disableWarnings = disableWarnings;
  return (data.environment.shared.get("SKDB") as SKDBShared).create(dbName);
}
