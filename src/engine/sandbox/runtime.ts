import { createRequire } from 'module';
import * as path from 'path';
import vm from 'vm';
import util from 'util';
import type { AppSettings } from '../../shared/ipc';

/**
 * Subprocess Runtime for Runner-JS
 * 
 * This script is executed as a child process via child_process.fork.
 * It manages the execution of user code, intercepts logs, and sends telemetry back to parent.
 */

// Track time labels
const timers = new Map<string, number>();

interface SerializedValue {
  type: string;
  value: unknown;
  className?: string;
  size?: number;
  signature?: string;
}

function serializeValue(value: unknown, depth = 0, seen = new WeakSet()): SerializedValue {
  if (value === null) return { type: 'null', value: null };
  if (value === undefined) return { type: 'undefined', value: undefined };

  const type = typeof value;
  
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return { type, value };
  }

  if (type === 'function') {
    const fn = value as Function;
    return { 
      type: 'function', 
      value: fn.name || '(anonymous)',
      signature: fn.toString().slice(0, 100) + (fn.toString().length > 100 ? '...' : '')
    };
  }

  if (value instanceof Date) {
    return { type: 'date', value: value.toISOString() };
  }

  if (value instanceof Promise) {
    return { type: 'promise', value: '[Promise]' };
  }

  // Handle circular references
  if (typeof value === 'object') {
    if (seen.has(value)) {
      return { type: 'circular', value: '[Circular]' };
    }
    seen.add(value);
  }

  if (depth >= 5) {
    return {
      type: 'serialized',
      value: util.inspect(value, { depth: 0, colors: false })
    };
  }

  if (value instanceof Map) {
    const entries: any[] = [];
    value.forEach((v, k) => {
      entries.push({
        key: serializeValue(k, depth + 1, seen),
        value: serializeValue(v, depth + 1, seen)
      });
    });
    return { type: 'map', value: entries, size: value.size };
  }

  if (value instanceof Set) {
    const values: any[] = [];
    value.forEach(v => {
      values.push(serializeValue(v, depth + 1, seen));
    });
    return { type: 'set', value: values, size: value.size };
  }

  if (Array.isArray(value)) {
    return {
      type: 'array',
      value: value.map(item => serializeValue(item, depth + 1, seen))
    };
  }
  
  if (typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    const keys = Object.keys(value as object);
    // Include non-enumerable properties if helpful? No, stick to own keys for now to match console.log
    for (const key of keys) {
      obj[key] = serializeValue((value as Record<string, unknown>)[key], depth + 1, seen);
    }
    
    // Check for special constructors
    const constructorName = (value as object).constructor?.name;
    const isPlainObject = !constructorName || constructorName === 'Object';
    
    return { 
      type: 'object', 
      value: obj,
      className: isPlainObject ? undefined : constructorName
    };
  }

  return { type: 'serialized', value: String(value) };
}

// Track sync phase for Match Lines
let isSyncPhase = true;

const setupRuntime = (options: { cwd?: string; env?: Record<string, string>; advanced?: AppSettings['advanced'] }) => {
  const { cwd, env, advanced } = options;

  if (cwd && typeof cwd === 'string') {
    try {
      process.chdir(cwd);
    } catch (err) {
      console.error('[Runtime] Failed to change directory:', err);
    }
  }

  let executionAborted = false;

  // Intercept console
  const extractMetadata = (args: unknown[]) => {
    let line: number | undefined = undefined;
    let finalArgs = args;
    let isPlain = false;
    
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      const firstArg = args[0] as any;
      if ('__runner_metadata__' in firstArg) {
        line = firstArg.__runner_metadata__.line;
        isPlain = !!firstArg.isPlain;
        finalArgs = args.slice(1);
      }
    }

    return { line, finalArgs, isPlain, aborted: false };
  };

  const captureMethod = (type: string) => {
    return (...args: unknown[]) => {
      const { line, finalArgs, isPlain, aborted } = extractMetadata(args);
      if (aborted) return;

      // Use util.format only if templates are likely present, otherwise preserve types for highlighting
      let processedValues: SerializedValue[];
      if (typeof finalArgs[0] === 'string' && finalArgs[0].includes('%') && finalArgs.length > 1) {
        processedValues = [{ type: 'string', value: util.format(...finalArgs) }];
      } else {
        processedValues = finalArgs.map(arg => serializeValue(arg));
      }

      process.send?.({
        type: 'log',
        payload: { type, value: processedValues, timestamp: Date.now(), line, isPlain }
      });
    };
  };

  const setupConsole = () => {
    const interceptedConsole: Record<string, any> = {};

    const methods: Array<keyof Console> = ['log', 'warn', 'error', 'info', 'debug', 'dir'];
    methods.forEach(method => {
      interceptedConsole[method] = captureMethod(method as string);
    });

    interceptedConsole.clear = () => process.send?.({ type: 'clear' });

    interceptedConsole.table = (...args: any[]) => {
      const { line, finalArgs, aborted } = extractMetadata(args);
      if (aborted) return;
      const data = finalArgs[0];
      
      let tableData: any = null;
      if (data && typeof data === 'object') {
        const rows: any[] = [];
        const columns = new Set<string>();
        columns.add('(index)');

        if (Array.isArray(data)) {
          data.forEach((item, index) => {
            const row: any = { '(index)': index };
            if (item && typeof item === 'object') {
              Object.keys(item).forEach(key => {
                columns.add(key);
                row[key] = serializeValue(item[key]);
              });
            } else {
              columns.add('Values');
              row['Values'] = serializeValue(item);
            }
            rows.push(row);
          });
        } else {
          Object.keys(data).forEach(key => {
            const item = data[key];
            const row: any = { '(index)': key };
            if (item && typeof item === 'object') {
              Object.keys(item).forEach(k => {
                columns.add(k);
                row[k] = serializeValue(item[k]);
              });
            } else {
              columns.add('Values');
              row['Values'] = serializeValue(item);
            }
            rows.push(row);
          });
        }

        tableData = {
          columns: Array.from(columns),
          rows
        };
      }

      process.send?.({
        type: 'log',
        payload: {
          type: 'table',
          value: [],
          table: tableData,
          timestamp: Date.now(),
          line
        }
      });
    };

    interceptedConsole.time = (...args: any[]) => {
      const { finalArgs } = extractMetadata(args);
      if (executionAborted) return;
      const label = String(finalArgs[0] || 'default');
      timers.set(label, performance.now());
    };

    interceptedConsole.timeEnd = (...args: any[]) => {
      const { line, finalArgs } = extractMetadata(args);
      if (executionAborted) return;
      const label = String(finalArgs[0] || 'default');
      
      const start = timers.get(label);
      if (start) {
        const duration = performance.now() - start;
        timers.delete(label);
        process.send?.({
          type: 'log',
          payload: {
            type: 'log',
            value: [{ type: 'string', value: `${label}: ${duration.toFixed(3)}ms` }],
            timestamp: Date.now(),
            line
          }
        });
      } else {
        process.send?.({
          type: 'log',
          payload: {
            type: 'warn',
            value: [{ type: 'string', value: `Timer '${label}' does not exist` }],
            timestamp: Date.now(),
            line
          }
        });
      }
    };

    interceptedConsole.group = (...args: any[]) => {
      const { line, finalArgs, aborted } = extractMetadata(args);
      if (aborted) return;
      process.send?.({
        type: 'log',
        payload: {
          type: 'group',
          value: finalArgs.map(arg => serializeValue(arg)),
          timestamp: Date.now(),
          line
        }
      });
    };

    interceptedConsole.groupCollapsed = (...args: any[]) => {
      const { aborted } = extractMetadata(args);
      if (aborted) return;
      interceptedConsole.group(...args);
    };

    interceptedConsole.groupEnd = () => {
      if (executionAborted) return;
      process.send?.({
        type: 'log',
        payload: {
          type: 'groupEnd',
          value: [],
          timestamp: Date.now()
        }
      });
    };

    return interceptedConsole;
  };

  const interceptedConsole = setupConsole();

  let callCount = 0;
  const MAX_CALLS = 10000;

  // Setup global sandbox
  const sandbox = {
    ...global,
    process: {
      ...process,
      env: { ...process.env, ...env },
      cwd: () => process.cwd(),
      exit: (code?: number) => process.exit(code)
    },
    console: { ...console, ...interceptedConsole },
    setTimeout: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
      const d = Math.max(delay || 0, 10);
      return setTimeout(callback, d, ...args);
    },
    setInterval: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
      const d = Math.max(delay || 0, 10);
      return setInterval(callback, d, ...args);
    },
    __loopStart: () => {
      callCount = 0;
      (sandbox as any).__loopCount = 0;
    },
    __loopCount: 0,
    __loopGuard: (line?: number) => {
      (sandbox as any).__loopCount++;
      if ((sandbox as any).__loopCount > 2000) {
        if (!executionAborted) {
          executionAborted = true;
          (interceptedConsole as any).error(
            { __runner_metadata__: { line }, isPlain: true },
            'RangeError: Potential infinite loop: exceeded',
            2000,
            'iterations.'
          );
        }
        return true; // Signal the transformer to break
      }
      return false;
    },
    __checkCall: (line?: number) => {
      callCount++;
      if (callCount > MAX_CALLS) {
        if (!executionAborted) {
          executionAborted = true;
          (interceptedConsole as any).error(
            { __runner_metadata__: { line }, isPlain: true },
            'RangeError: Potential infinite recursion: exceeded',
            MAX_CALLS,
            'calls'
          );
        }
        return true; // Signal the transformer to return
      }
      return false;
    },
    __capture: (line: number, value: unknown) => {
      if (value === undefined && !advanced?.showUndefined) return value;
      
      const shouldDisplay = (val: unknown) => {
        if (val === undefined) return false;
        if (typeof val === "function") return false;
        if (val && typeof val === "object") {
          const name = (val as { constructor?: { name?: string } }).constructor?.name;
          return !["Timeout", "Immediate", "Interval"].includes(name || '');
        }
        return true;
      };

      if (shouldDisplay(value)) {
        const serialized = serializeValue(value);
        if (isSyncPhase) {
          process.send?.({ type: 'capture', payload: { line, value: serialized } });
        } else {
          process.send?.({
            type: 'log', 
            payload: { type: 'log', value: [serialized], timestamp: Date.now(), line, isCaptured: true }
          });
        }
      }
      return value;
    }
  };

  // Setup require
  if (cwd) {
    const customRequire = createRequire(path.join(cwd, 'index.js'));
    (sandbox as unknown as Record<string, unknown>).require = customRequire;
    (sandbox as unknown as Record<string, unknown>).__dirname = cwd;
    (sandbox as unknown as Record<string, unknown>).__filename = path.join(cwd, 'scratchpad.js');
  }

  return vm.createContext(sandbox);
};

process.on('message', (message: { type: string, code: string, cwd?: string, env?: Record<string, string>, advanced?: AppSettings['advanced'] }) => {
  if (message.type === 'execute') {
    const { code, cwd, env, advanced } = message;
    const context = setupRuntime({ cwd, env, advanced });

    // Reset loop timer
    (context as any).__loopStart?.();

    try {
      const script = new vm.Script(code);
      const result = script.runInContext(context, { displayErrors: true });
      
      isSyncPhase = false;
      process.send?.({ type: 'result', payload: { success: true, result: serializeValue(result) } });
    } catch (e: any) {
      isSyncPhase = false;
      let errorMsg = e.message;
      
      if (e instanceof RangeError && e.message.includes('Maximum call stack size exceeded')) {
        errorMsg = 'RangeError: Maximum call stack size exceeded (Infinite recursion detected)';
      }

      process.send?.({
        type: 'result',
        payload: {
          success: false,
          error: errorMsg,
          stack: e.stack
        }
      });
    }
  }
});
