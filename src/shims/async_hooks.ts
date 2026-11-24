// Synchronous-only AsyncLocalStorage: the store is visible during run(), which
// is enough for the request scoping the backend does.
export class AsyncLocalStorage<T> {
  private store?: T;
  getStore() { return this.store; }
  run<R>(store: T, callback: (...args: any[]) => R, ...args: any[]): R {
    const previous = this.store;
    this.store = store;
    try { return callback(...args); } finally { this.store = previous; }
  }
  enterWith(store: T) { this.store = store; }
  disable() { this.store = undefined; }
}
export default { AsyncLocalStorage };
