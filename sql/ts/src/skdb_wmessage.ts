import {
  onWorkerMessage,
  type Creator,
  State,
} from "../skipwasm-std/sk_worker.js";
import type { SKDB } from "./skdb.js";
import { createSkdb } from "./skdb.js";

class DbCreator implements Creator<SKDB> {
  getName() {
    return "create";
  }

  getType() {
    return "Database";
  }

  create(dbName: string, disableWarnings: boolean) {
    return createSkdb({
      dbName,
      disableWarnings,
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
