import { onDbWorkerMessage, imhere } from "./skdb_wmessage.js";
import { parentPort } from "worker_threads";

const post = (message: any) => {
  parentPort?.postMessage(message);
};

const close = () => {
  parentPort?.close();
};

const onMessage = (message: MessageEvent) =>
  onDbWorkerMessage(message, post, close);

parentPort?.on("message", onMessage);
imhere(post);
