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

function serializeValue(value: unknown, depth = 0): { type: string, value: unknown } {
  const type = value === null ? 'null' : typeof value;
  
  if (type === 'string' || type === 'number' || type === 'boolean' || value === null || value === undefined) {
    return { type, value };
  }

  // Recursive path for plain objects and arrays
  if (depth < 3) {
    if (Array.isArray(value)) {
      return {
        type: 'array',
        value: value.map(item => serializeValue(item, depth + 1))
      };
    }
    
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      const obj: Record<string, unknown> = {};
      for (const key of Object.keys(value as object)) {
        obj[key] = serializeValue((value as Record<string, unknown>)[key], depth + 1);
      }
      return { type: 'object', value: obj };
    }
  }

  try {
    return {
      type: 'serialized',
      value: util.inspect(value, {
        depth: 3,
        colors: false,
        maxArrayLength: 50
      })
    };
  } catch {
    return { type: 'serialized', value: "[Unserializable Value]" };
  }
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

  // Intercept console
  const captureMethod = (type: string) => {
    return (...args: unknown[]) => {
      let line: number | undefined = undefined;
      let finalArgs = args;

      if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && '__runner_line' in args[0]) {
        line = (args[0] as { __runner_line: number }).__runner_line;
        finalArgs = args.slice(1);
      }

      // Use util.format only if templates are likely present, otherwise preserve types for highlighting
      let processedValues: { type: string, value: unknown }[];
      if (typeof finalArgs[0] === 'string' && finalArgs[0].includes('%') && finalArgs.length > 1) {
        processedValues = [{ type: 'string', value: util.format(...finalArgs) }];
      } else {
        processedValues = finalArgs.map(arg => serializeValue(arg));
      }

      process.send?.({
        type: 'log',
        payload: { type, value: processedValues, timestamp: Date.now(), line }
      });
    };
  };

  const interceptedConsole: Record<string, (...args: unknown[]) => void> = {
    log: captureMethod('log'),
    warn: captureMethod('warn'),
    error: captureMethod('error'),
    info: captureMethod('info'),
    debug: captureMethod('debug'),
    clear: () => process.send?.({ type: 'clear' }),
    table: captureMethod('log'),
  };

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

    try {
      const script = new vm.Script(code);
      const result = script.runInContext(context, { displayErrors: true });
      
      isSyncPhase = false;
      process.send?.({ type: 'result', payload: { success: true, result: serializeValue(result) } });
    } catch (e: any) {
      isSyncPhase = false;
      process.send?.({
        type: 'result',
        payload: {
          success: false,
          error: e.message,
          stack: e.stack
        }
      });
    }
  }
});
