import { type ModuleInit } from "#std/sk_types.js";
import { createOnThisThread } from "./skdb_create.js";
import { onWorkerMessage, imhere } from "#std/sk_worker.js";
import type { Creator } from "#std/sk_worker.js";
import type { SKDB } from "./skdb.js";

const modules: ModuleInit[] = [];
/*--MODULES--*/

class DbCreator implements Creator<SKDB> {
  getName() {
    return "create";
  }

  getType() {
    return "Database";
  }

  async create(dbName?: string) {
    return createOnThisThread(false, modules, dbName);
  }
}

const creator = new DbCreator();

const post = (message: any) => {
  postMessage(message);
};

var onMessage = (message: MessageEvent) =>
  onWorkerMessage(message.data, post, creator);

addEventListener("message", onMessage);
imhere(post);
