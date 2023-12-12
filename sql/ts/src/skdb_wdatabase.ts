import type { Wrk } from "#std/sk_types.js";
import { PromiseWorker, Function, Caller } from "#std/sk_worker.js";
import type {
  SKDB,
  ProtoResponseCreds,
  Params,
  RemoteSKDB,
  MirrorDefn,
} from "./skdb_types.js";
import { SKDBTable } from "./skdb_util.js";
import { SKDBGroupImpl } from "./skdb_group.js";

class WrappedRemote implements RemoteSKDB {
  private worker: PromiseWorker;
  private wrapped: number;
  private unregister: () => void;

  constructor(worker: PromiseWorker, wrapped: number, unregister: () => void) {
    this.worker = worker;
    this.wrapped = wrapped;
    this.unregister = unregister;
  }

  private prv_exec = async (fn: Caller | Function) => {
    let sender = await this.worker.post(fn);
    return sender.send();
  };

  createDatabase(dbName: string) {
    return this.prv_exec(new Caller(this.wrapped, "createDatabase", [dbName]));
  }

  createUser() {
    return this.prv_exec(new Caller(this.wrapped, "createUser", []));
  }

  schema() {
    return this.prv_exec(new Caller(this.wrapped, "schema", []));
  }

  tableSchema(tableName: string) {
    return this.prv_exec(new Caller(this.wrapped, "tableSchema", [tableName]));
  }

  notifyConnectedAs(userName: string, replicationId: string) {
    return this.prv_exec(new Caller(this.wrapped, "notifyConnectedAs", [userName, replicationId]));
  }

  viewSchema(viewName: string) {
    return this.prv_exec(new Caller(this.wrapped, "viewSchema", [viewName]));
  }

  mirror(...tables: MirrorDefn[]) {
    return this.prv_exec(
      new Caller(this.wrapped, "mirror", tables, {
        register: true,
        remove: "mirror",
      }),
    );
  }

  exec(query: string, params?: Params) {
    return this.prv_exec(new Caller(this.wrapped, "exec", [query, params]));
  }

  close() {
    this.unregister();
    return this.prv_exec(
      new Caller(this.wrapped, "close", [], { autoremove: true }),
    );
  }

  isConnectionHealthy() {
    return this.prv_exec(new Caller(this.wrapped, "isConnectionHealthy", []));
  }

  tablesAwaitingSync() {
    return this.prv_exec(new Caller(this.wrapped, "tablesAwaitingSync", []));
  }

  onReboot(fn: () => void): Promise<void> {
    return this.prv_exec(new Caller(this.wrapped, "onReboot", [fn]));
  }

  connectedAs(): Promise<string> {
    return this.prv_exec(new Caller(this.wrapped, "connectedAs", []));
  }
}

export class SKDBWorker implements SKDB {
  private wrappedId: number;
  private worker: PromiseWorker;
  private remote?: WrappedRemote;

  constructor(createWorker: () => Wrk, reload?: number) {
    this.wrappedId = 0;
    this.worker = new PromiseWorker(createWorker, reload);
  }

  private prv_exec = async (fn: Caller | Function) => {
    let sender = await this.worker.post(fn);
    return sender.send();
  };

  create = async (dbName?: string): Promise<void> => {
    return this.prv_exec(new Function("create", [dbName], { register: true }));
  };

  exec = async (query: string, params: Params = new Map()) => {
    let sender = await this.worker.post(new Function("exec", [query, params]));
    const rows = await sender.send();
    return new SKDBTable(...rows);
  };

  watch = async (
    query: string,
    params: Params,
    onChange: (rows: SKDBTable) => void,
  ) => {
    let provider = await this.worker.post(
      new Function("watch", [query, params, onChange], {
        wrap: ++this.wrappedId,
        autoremove: true,
        register: true,
      }),
    );
    let wrapped = await provider.send();
    let close = async () => {
      let sender = await this.worker.post(
        new Caller(wrapped.wrapped, "close", []),
      );
      sender.send().then(provider.close);
    };
    return { close: close };
  };

  watchChanges = async (
    query: string,
    params: Params,
    init: (rows: SKDBTable) => void,
    update: (added: SKDBTable, removed: SKDBTable) => void,
  ) => {
    let provider = await this.worker.post(
      new Function("watchChanges", [query, params, init, update], {
        wrap: ++this.wrappedId,
        autoremove: true,
        register: true,
      }),
    );
    let wrapped = await provider.send();
    let close = async () => {
      let sender = await this.worker.post(
        new Caller(wrapped.wrapped, "close", []),
      );
      sender.send().then(provider.close);
    };
    return { close: close };
  };

  tableSchema = async (tableName: string) => {
    return this.prv_exec(
      new Function("tableSchema", [tableName]),
    ) as Promise<string>;
  };

  notifyConnectedAs = async (userName: string, replicationId: string) => {
    return this.prv_exec(new Function("notifyConnectedAs", [userName, replicationId]));
  };

  viewSchema = async (viewName: string) => {
    return this.prv_exec(
      new Function("viewSchema", [viewName]),
    ) as Promise<string>;
  };

  schema = async (tableName?: string) => {
    return this.prv_exec(
      new Function("schema", [tableName]),
    ) as Promise<string>;
  };

  insert = async (tableName: string, values: Array<any>) => {
    return this.prv_exec(
      new Function("insert", [tableName, values]),
    ) as Promise<boolean>;
  };

  insertMany = async (
    tableName: string,
    valuesArray: Array<Record<string, any>>,
  ) => {
    let result = await this.prv_exec(new Function("insertMany", [tableName, valuesArray]));
    if (result instanceof Error) {
      throw result;
    }
    return result as Promise<number>;
  };

  save = async () => {
    return this.prv_exec(new Function("save", [])) as Promise<boolean>;
  };

  createServerDatabase = async (dbName: string) => {
    return this.prv_exec(
      new Function("createServerDatabase", [dbName]),
    ) as Promise<ProtoResponseCreds>;
  };

  createServerUser = async () => {
    return this.prv_exec(
      new Function("createServerUser", []),
    ) as Promise<ProtoResponseCreds>;
  };

  mirror = async (...tables: MirrorDefn[]) => {
    return this.prv_exec(
      new Function("mirror", tables, { register: true, remove: "mirror" }),
    );
  };

  closeConnection = async () => {
    let res = this.prv_exec(new Function("closeConnection", []));
    this.remote = undefined;
    return res;
  };

  currentUser?: string;

  connect = async (
    db: string,
    accessKey: string,
    privateKey: CryptoKey,
    endpoint?: string,
  ) => {
    this.currentUser = accessKey;
    return this.prv_exec(
      new Function("connect", [db, accessKey, privateKey, endpoint], {
        register: true,
        remove: "closeConnection",
      }),
    );
  };

  connectedRemote = async () => {
    if (!this.remote) {
      let wrapId = ++this.wrappedId;
      let provider = await this.worker.post(
        new Function("connectedRemote", [], {
          wrap: wrapId,
          register: true,
        }),
      );
      let wrapped = await provider.send();
      this.remote = new WrappedRemote(this.worker, wrapped.wrapped, () => {
        this.remote = undefined;
        provider.close();
      });
    }
    return this.remote;
  };

  getUser = async () => {
    return this.prv_exec(new Function("getUser", []));
  };

  // @ts-ignore
  createGroup = async () => {
    return SKDBGroupImpl.create(this);
  };

  lookupGroup = async (groupID: string) => {
    return SKDBGroupImpl.lookup(this, groupID);
  };

  shutdown = () => this.worker.shutdown();
  terminate = () => this.worker.terminate();
}
