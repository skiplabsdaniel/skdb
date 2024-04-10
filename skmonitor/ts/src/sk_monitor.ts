// sknpm: Cannot be multiline for package sources
// prettier-ignore
import type { int, ptr, float, Environment, Links, ToWasmManager, Utils } from "#std/sk_types.js";

interface ToWasm {
  SKIP_SKMonitor_appendToFifo: (fifo: ptr, content: ptr) => int;
  SKIP_SKMonitor_checkFifo: (fifo: ptr) => int;
  SKIP_JS_now: () => float;
}

class LinksImpl implements Links {
  SKIP_SKMonitor_appendToFifo!: (fifo: ptr, content: ptr) => int;
  SKIP_SKMonitor_checkFifo!: (fifo: ptr) => int;

  constructor() {}

  complete = (utils: Utils, exports: object) => {
    this.SKIP_SKMonitor_appendToFifo = (fifo: ptr, content: ptr) => {
      console.log(utils.importString(content));
      return 1;
    };
    this.SKIP_SKMonitor_checkFifo = (fifo: ptr) => {
      return 1;
    };
  };
}

class Manager implements ToWasmManager {
  constructor() {}

  prepare = (wasm: object) => {
    let toWasm = wasm as ToWasm;
    let links = new LinksImpl();
    toWasm.SKIP_SKMonitor_appendToFifo = (fifo: ptr, content: ptr) =>
      links.SKIP_SKMonitor_appendToFifo(fifo, content);
    toWasm.SKIP_SKMonitor_checkFifo = (fifo: ptr) =>
      links.SKIP_SKMonitor_checkFifo(fifo);
    toWasm.SKIP_JS_now = () => Date.now() / 1000;
    return links;
  };
}

/** @sk init */
export function init(env?: Environment) {
  return Promise.resolve(new Manager());
}
