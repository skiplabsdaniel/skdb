import { onWorkerMessage, State } from "#std/sk_worker.js";
import type { Creator } from "#std/sk_worker.js";
import type { SKDB } from "./skdb.js";
import { createSkdb } from "./skdb.js";

class DbCreator implements Creator<SKDB> {
  getName() {
    return "create";
  }

  getType() {
    return "Database";
  }

  create(dnName: string) {
    return createSkdb({
      dbName: dnName,
      asWorker: false,
    });
  }

  shutdown(created: SKDB) {
    return created.closeConnection();
  }
}

const creator = new DbCreator();
const state = new State();

export const onDbWorkerMessage = (
  message: MessageEvent,
  post: (message: any) => void,
  close: () => void,
) => {
  onWorkerMessage(state, message, post, close, creator);
};
