import { loadEnv, isNode } from "../skipwasm-std/index.js";
import { createOnThisThread } from "./skdb_create.js";
import type { Wrk, ModuleInit } from "../skipwasm-std/index.js";
import type { SKDB } from "./skdb_types.js";
import { SKDBWorker } from "./skdb_wdatabase.js";
export { SKDBTable } from "./skdb_util.js";
export type {
  SKDB,
  RemoteSKDB,
  MirrorDefn,
  SKDBGroup,
  Params,
} from "./skdb_types.js";
export type { Creds, MuxedSocket } from "./skdb_orchestration.js";
export type { Environment } from "../skipwasm-std/index.js";
export { SKDBTransaction } from "./skdb_util.js";

import { init as runtimeInit } from "../skipwasm-std/sk_runtime.js";
import { init as posixInit } from "../skipwasm-std/sk_posix.js";
import { init as skjsonInit } from "../skipwasm-json/skjson.js";
import { init as skdateInit } from "../skipwasm-date/sk_date.js";
import { init as skdbInit } from "./skdb_skdb.js";

const modules: ModuleInit[] = [
  runtimeInit,
  posixInit,
  skjsonInit,
  skdateInit,
  skdbInit,
];

export async function createSkdb(
  options: {
    dbName?: string;
    asWorker?: boolean;
    getWasmSource?: () => Promise<Uint8Array>;
    disableWarnings?: boolean;
  } = {},
): Promise<SKDB> {
  const asWorker = options.asWorker ?? !options.getWasmSource;
  const disableWarnings = options.disableWarnings ?? false;
  if (!asWorker) {
    return createOnThisThread(
      disableWarnings,
      modules,
      options.dbName,
      options.getWasmSource,
    );
  } else {
    if (options.getWasmSource) {
      throw new Error("getWasmSource is not compatible with worker");
    }
    return createWorker(disableWarnings, options.dbName);
  }
}

async function createWorker(disableWarnings: boolean, dbName?: string) {
  const env = await loadEnv([]);
  env.disableWarnings = disableWarnings;
  let worker: Wrk;
  if (isNode()) {
    const url = new URL("./skdb_nodeworker.js", import.meta.url);
    worker = env.createWorker(url, { type: "module" });
  } else {
    // important that this line looks exactly like this for bundlers to discover the file
    const wrapped = new Worker(new URL("./skdb_worker.js", import.meta.url), {
      type: "module",
    });
    worker = env.createWorkerWrapper(wrapped);
  }

  const skdb = new SKDBWorker(worker);
  await skdb.create(dbName, disableWarnings);
  return skdb;
}
