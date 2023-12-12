import type { int, Wrk } from "./sk_types.js";

interface Payload {}

export type FnOptions = {
  wrap?: int;
  autoremove?: boolean;
  register?: boolean;
  remove?: string;
};

type Callable = Function | Caller;

export class Wrappable {
  wrappedId?: int;
}

var sourcesLastId = 0;

class UnmanagedMessage extends Error {
  constructor(msg: any) {
    super(msg);
  }
}

export class Function implements Payload {
  fn: string;
  parameters: Array<any>;
  options?: FnOptions;

  constructor(fn: string, parameters: Array<any>, options?: FnOptions) {
    this.fn = fn;
    this.parameters = parameters;
    this.options = options;
  }

  static as(obj: object) {
    if (!("fn" in obj) || !("parameters" in obj)) return null;
    let options = "options" in obj ? (obj.options! as FnOptions) : undefined;
    let fn = new Function(
      obj.fn! as string,
      obj.parameters! as Array<any>,
      options,
    );
    return fn;
  }

  static isValid(obj: object) {
    return "fn" in obj && "parameters" in obj;
  }
}

export class Caller implements Payload {
  wrapped: number;
  fn: string;
  parameters: Array<any>;
  options?: FnOptions;

  constructor(
    wrapped: number,
    fn: string,
    parameters: Array<any>,
    options?: FnOptions,
  ) {
    this.wrapped = wrapped;
    this.fn = fn;
    this.parameters = parameters;
    this.options = options;
  }

  static convert(obj: object) {
    if (!("wrapped" in obj) || !("fn" in obj) || !("parameters" in obj))
      return null;
    let options = "options" in obj ? (obj.options! as FnOptions) : undefined;
    let fn = new Caller(
      obj.wrapped! as number,
      obj.fn! as string,
      obj.parameters! as Array<any>,
      options,
    );
    return fn;
  }

  static isValid(obj: object) {
    return "fn" in obj && "parameters" in obj;
  }
}

export class Return implements Payload {
  success: boolean;
  value: any;

  constructor(success: boolean, value: any) {
    this.success = success;
    this.value = value;
  }

  static as(obj: object) {
    if (!("success" in obj) || !("value" in obj)) return null;
    return new Return(obj.success! as boolean, obj.value!);
  }
}

export class MessageId {
  source: number;
  id: number;

  constructor(source: number, id: number) {
    this.source = source;
    this.id = id;
  }

  static as(obj: object) {
    if (!("source" in obj) || !("id" in obj)) return null;
    return new MessageId(obj.source! as number, obj.id! as number);
  }
}

export class Wrapped {
  wrapped: number;

  constructor(wrapped: number) {
    this.wrapped = wrapped;
  }

  static as(obj: object) {
    if (!("wrapped" in obj)) return null;
    return new Wrapped(obj.wrapped! as number);
  }
}

function asKey(messageId: MessageId) {
  return "" + messageId.source + ":" + messageId.id;
}

export class Sender {
  close: () => void;
  send: () => Promise<any>;

  constructor(close: () => void, send: () => Promise<any>) {
    this.close = close;
    this.send = send;
  }
}

export class Message {
  id: MessageId;
  payload: Payload;

  constructor(id: MessageId, payload: Payload) {
    this.id = id;
    this.payload = payload;
  }

  static asFunction(obj: object) {
    if (!("id" in obj) || !("payload" in obj)) return null;
    let messageId = MessageId.as(obj.id!);
    let payload = Function.as(obj.payload!);
    if (messageId && payload) {
      return new Message(messageId, payload);
    }
    return null;
  }

  static asCaller(obj: object) {
    if (!("id" in obj) || !("payload" in obj)) return null;
    let messageId = MessageId.as(obj.id!);
    let payload = Caller.convert(obj.payload!);
    if (messageId && payload) {
      return new Message(messageId, payload);
    }
    return null;
  }

  static asReturn(obj: object) {
    if (!("id" in obj) || !("payload" in obj)) return null;
    let messageId = MessageId.as(obj.id!);
    let payload = Return.as(obj.payload!);
    if (messageId && payload) {
      return new Message(messageId, payload);
    }
    return null;
  }
}

export class PromiseWorker {
  private lastId: number;
  private source: number;
  private worker: Wrk;
  private callbacks: Map<string, (...args: any[]) => any>;
  private subscriptions: Map<string, (...args: any[]) => void>;
  private mark: Date;
  private registered: Callable[];
  private posted: Message[];
  private unregister: Map<string, Function>;
  private reloaded: number;
  public reloading: boolean;

  private reload: () => Promise<void>;

  post: (fn: Function) => Promise<Sender>;
  onMessage: (message: MessageEvent) => void;
  check: () => boolean;

  constructor(createWorker: () => Wrk, reload?: number) {
    this.lastId = 0;
    this.worker = createWorker();
    this.source = ++sourcesLastId;
    this.callbacks = new Map();
    this.subscriptions = new Map();
    this.mark = new Date();
    this.registered = [];
    this.unregister = new Map();
    this.posted = [];
    this.reloading = false;
    this.reloaded = 0;

    const unregister = (fn: Callable) => {
      for (let i = 0; i < this.registered.length; i++) {
        if (this.registered[i] == fn) {
          this.registered.splice(i, 1);
        }
      }
    };
    const checkRegistration = (fn: Callable) => {
      // Check unregistration first
      let unregisterId: string;
      if (fn instanceof Caller) {
        unregisterId = "" + fn.wrapped + ":" + fn.fn;
      } else {
        unregisterId = fn.fn;
      }
      if (this.unregister.has(unregisterId)) {
        unregister(this.unregister.get(unregisterId)!);
        this.unregister.delete(unregisterId);
      }
      if (fn.options?.register) {
        this.registered.push(fn);
        if (fn.options?.remove) {
          if (fn instanceof Caller) {
            this.unregister.set("" + fn.wrapped + ":" + fn.options?.remove, fn);
          } else {
            this.unregister.set(fn.options?.remove, fn);
          }
        }
      }
    };
    const received = (msgId: MessageId) => {
      for (let i = 0; i < this.posted.length; i++) {
        if (this.posted[i].id == msgId) {
          this.posted.splice(i, 1);
        }
      }
    };
    let self = this;
    this.post = async (fn: Function | Caller) => {
      if (!this.check()) {
        await this.reload();
      }
      checkRegistration(fn);
      let messageId = new MessageId(this.source, ++this.lastId);
      let subscribed = new Set<string>();
      const parameters = fn.parameters.map((p) => {
        if (typeof p == "function") {
          let subscriptionId = new MessageId(this.source, ++this.lastId);
          let wfn = (result: Return) => p.apply(null, result.value);
          let key = asKey(subscriptionId);
          this.subscriptions.set(key, wfn);
          subscribed.add(key);
          return subscriptionId;
        } else {
          return p;
        }
      });
      fn.parameters = parameters;
      return new Sender(
        () => {
          subscribed.forEach((key) => this.subscriptions.delete(key));
          if (fn.options?.register) {
            unregister(fn);
            if (fn.options?.remove) {
              let unregisterId: string;
              if (fn instanceof Caller) {
                unregisterId = "" + fn.wrapped + ":" + fn.fn;
              } else {
                unregisterId = fn.fn;
              }
              this.unregister.delete(unregisterId);
            }
          }
        },
        () =>
          new Promise(function (resolve, reject) {
            self.callbacks.set(asKey(messageId), (result: Return) => {
              if (result.success) {
                resolve(result.value);
              } else if (result.value instanceof Error) {
                reject(result.value);
              } else {
                reject(new Error(JSON.stringify(result.value)));
              }
            });
            let message = new Message(messageId, fn);
            self.posted.push(message);
            self.worker.postMessage(message);
          }),
      );
    };

    this.onMessage = (message: MessageEvent) => {
      this.mark = new Date();
      let msg = message.data != undefined ? message.data : message;
      if (msg == "imhere") {
        return;
      }
      let data = typeof msg == "object" ? Message.asReturn(msg) : null;
      if (!data) {
        throw new UnmanagedMessage(message);
      } else {
        let result = data.payload as Return;
        received(data.id);
        let callId = asKey(data.id);
        let callback = this.callbacks.get(callId);
        if (callback) {
          this.callbacks.delete(callId);
          callback(data.payload);
          return;
        }
        let subscription = this.subscriptions.get(callId);
        if (subscription) {
          subscription(data.payload);
          return;
        }
        if (result.value instanceof Error) {
          throw result.value;
        } else
          throw new Error("Return with no callback" + JSON.stringify(data));
      }
    };
    this.check = () => {
      if (reload != undefined && reload > 0) {
        const diff = new Date().getTime() - this.mark.getTime();
        const seconds = diff / 1000;
        if (seconds > reload) {
          return false;
        }
      }
      return true;
    };
    this.reload = async () => {
      console.log("///// RELOAD //////");
      // Just in case is not really shutdown
      this.shutdown();
      this.reloading = true;
      let toRegister = this.registered;
      let toPost = this.posted;
      this.registered = [];
      this.posted = [];
      this.callbacks = new Map();
      this.subscriptions = new Map();
      this.unregister = new Map();
      this.worker = createWorker();
      this.mark = new Date();
      this.worker.onMessage(this.onMessage);
      for (let i = 0; i < toRegister.length; i++) {
        let fn = toRegister[i];
        let sender = await this.post(fn);
        try {
          await sender.send();
        } catch (exn) {
          throw exn;
        }
      }
      for (let i = 0; i < toPost.length; i++) {
        this.post(toPost[i].payload as Callable);
      }
      this.reloading = false;
      this.reloaded++;
    };
    this.worker.onMessage(this.onMessage);
  }

  shutdown = () => {
    this.worker.shutdown();
  };

  terminate = () => {
    this.worker.terminate();
  };
}


function apply<R>(
  post: (message: any) => void,
  id: MessageId,
  caller: any,
  fn: (...args: any) => Promise<R>,
  parameters: any[],
  conv: (res: any) => any = (v) => v,
): void {
  fn.apply(caller, parameters)
    .then((result: any) => {
      post(new Message(id, new Return(true, conv(result))));
    })
    .catch((e: any) => {
      // Firefox don't transmit Worker message if an object of type Error is in the message.
      post(
        new Message(id, new Return(false, e instanceof Error ? e.message : e)),
      );
    });
}

var runner: object;
var wrappedId = 0;
var wrapped = new Map<number, { value: any; autoremove: boolean }>();

export interface Creator<T> {
  getName: () => string;
  getType: () => string;
  create: (...args: any[]) => Promise<T>;
  shutdown: (created: T) => Promise<void>;
}

export const imhere = (post: (message: any) => void) => {
  setInterval(() => post("imhere"), 1000);
};

export class State {
  runner?: object;
  wrapped: Map<number, { value: any; autoremove: boolean }>;

  constructor() {
    this.wrapped = new Map();
  }
}

export const onWorkerMessage = <T>(
  state: State,
  message: MessageEvent,
  post: (message: any) => void,
  close: () => void,
  creator: Creator<T>,
) => {
  if (
    state.runner &&
    typeof message == "string" &&
    "" + message == "#shutdown"
  ) {
    creator.shutdown(state.runner as T);
    close();
    return;
  }
  let data = Message.asCaller(message);
  if (!data) {
    data = Message.asFunction(message);
    if (!data) {
      post("Invalid worker message");
    } else {
      let fun = data.payload as Function;
      let parameters = fun.parameters.map((p) => {
        const subscription = typeof p == "object" ? MessageId.as(p) : null;
        if (subscription) {
          return (...args: any[]) => {
            post(new Message(subscription, new Return(true, args)));
          };
        } else {
          return p;
        }
      });
      if (fun.fn == creator.getName()) {
        if (state.runner) {
          post(
            new Message(
              data.id,
              new Return(false, creator.getType() + " already created"),
            ),
          );
        } else {
          apply(
            post,
            data!.id,
            creator,
            creator.create,
            parameters,
            (created) => {
              runner = created as object;
              return null;
            },
          );
        }
      } else if (!state.runner) {
        post(
          new Message(data.id, new Return(false, "Database must be created")),
        );
      } else {
        // @ts-ignore
        let fn = state.runner[fun.fn];
        if (typeof fn !== "function") {
          post(
            new Message(
              data.id,
              new Return(false, "Invalid database function " + fun.fn),
            ),
          );
        } else {
          apply(post, data!.id, runner, fn, parameters, (result: any) => {
            if (fun.options && fun.options.wrap !== undefined) {
              let wId = fun.options.wrap;
              state.wrapped.set(wId, {
                value: result,
                autoremove: fun.options.autoremove ? true : false,
              });
              if (result instanceof Wrappable) {
                result.wrappedId = wId;
              }
              result = new Wrapped(wId);
            }
            return result;
          });
        }
      }
    }
  } else {
    let caller = data.payload as Caller;
    let parameters = caller.parameters.map((p) => {
      const subscription = typeof p == "object" ? MessageId.as(p) : null;
      if (subscription) {
        return (...args: any[]) => {
          post(new Message(subscription, new Return(true, args)));
        };
      } else {
        return p;
      }
    });
    let obj = state.wrapped.get(caller.wrapped);
    let fni =
      caller.fn == ""
        ? { fn: obj?.value, obj: null }
        : { fn: obj?.value[caller.fn], obj: obj?.value };
    if (typeof fni.fn !== "function") {
      post(
        new Message(
          data.id,
          new Return(false, "Invalid function " + caller.fn),
        ),
      );
    } else {
      apply(post, data!.id, fni.obj, fni.fn, parameters);
    }
    if (obj?.autoremove || caller.options?.autoremove) {
      state.wrapped.delete(caller.wrapped);
    }
  }
};
