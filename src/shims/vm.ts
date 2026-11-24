// Node `vm` without isolation: code runs in this realm with the context's keys
// as local variables. Enough for the `eval` package and other loaders; not a
// security boundary (neither is Node's vm).
const identifier = /^[A-Za-z_$][\w$]*$/;
const reserved = new Set(['eval', 'arguments', 'this', 'let', 'yield', 'await', 'enum', 'implements', 'interface', 'package', 'private', 'protected', 'public', 'static']);

function run(code: string, context: Record<string, unknown> = {}) {
  const names = Object.keys(context).filter((name) => identifier.test(name) && !reserved.has(name));
  // A direct eval inside the function sees the parameters as variables.
  return new Function(...names, `return eval(${JSON.stringify(code)})`)(...names.map((name) => context[name]));
}

export class Script {
  constructor(private readonly code: string) {}
  runInThisContext() { return (0, eval)(this.code); }
  runInNewContext(context?: Record<string, unknown>) { return run(this.code, context); }
  runInContext(context: Record<string, unknown>) { return run(this.code, context); }
}

export const createContext = <T extends object>(context: T = {} as T) => context;
export const isContext = () => true;
export const runInThisContext = (code: string) => new Script(code).runInThisContext();
export const runInNewContext = (code: string, context?: Record<string, unknown>) => run(code, context);
export const runInContext = runInNewContext;

export default { Script, createContext, isContext, runInThisContext, runInNewContext, runInContext };
