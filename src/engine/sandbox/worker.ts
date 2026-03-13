import { parentPort, workerData } from 'worker_threads';
import vm from 'vm';
import { createRequire } from 'module';
import * as path from 'path';
import util from 'util';

/**
 * Safely serializes values for parentPort.postMessage to avoid "could not be cloned" errors.
 * Functions, Promises, and instances are problematic for structured clone.
 */
function serializeValue(value: unknown): any {
  if (typeof value === "function") {
    return "[Function]";
  }

  if (value instanceof Promise) {
    return "[Promise]";
  }

  // Simple primitives are usually fine, but for consistency with the request and 
  // to avoid deep objects with non-clonable properties, we use util.inspect.
  try {
    return util.inspect(value, {
      depth: 3,
      colors: false,
      maxArrayLength: 50
    });
  } catch (err) {
    return "[Unserializable Value]";
  }
}

// Replace console to send messages back to the parent thread
const createInterceptedConsole = () => {
  const customConsole: Partial<Console> = {};

  const captureMethod = (type: string) => {
    return (...args: unknown[]) => {
      let line: number | undefined = undefined;
      let finalArgs = args;

      // Extract our injected line number metadata if present
      if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && '__runner_line' in args[0]) {
        line = (args[0] as any).__runner_line;
        finalArgs = args.slice(1);
      }

      // Serialize all arguments to avoid cloning issues
      const serializedArgs = finalArgs.map(serializeValue);

      parentPort?.postMessage({
        type: 'log',
        payload: {
          type,
          value: serializedArgs,
          timestamp: Date.now(),
          line // Include extracted line number
        }
      });
    };
  };

  customConsole.log = captureMethod('log');
  customConsole.warn = captureMethod('warn');
  customConsole.error = captureMethod('error');
  customConsole.info = captureMethod('info');
  customConsole.debug = captureMethod('debug');
  customConsole.clear = () => {};
  customConsole.table = captureMethod('log');

  return customConsole as Console;
};

const safeConsole = createInterceptedConsole();

// Track if we are in the initial synchronous execution pass
let isSyncPhase = true;

/**
 * Determines if an expression result should be sent to the UI.
 * Filters out internal types like Timeout, Interval, etc.
 */
function shouldDisplayExpression(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value === "function") return false;

  if (value && typeof value === "object") {
    const name = (value as any).constructor?.name;
    if (name === "Timeout" || name === "Immediate" || name === "Interval") {
      return false;
    }
  }

  return true;
}

// Create the context for the VM
const sandbox: Record<string, unknown> = {
  console: safeConsole,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  Buffer,
  process: {
    ...process,
    env: { ...process.env, ...(workerData.env || {}) },
    cwd: () => workerData.cwd || process.cwd(),
    // Polyfill exit to just stop the worker
    exit: (code?: number) => {
       process.exit(code);
    }
  },
  fetch: typeof fetch !== 'undefined' ? fetch : undefined,
  // Provide a minimal React shim for JSX support
  React: {
    createElement: (type: unknown, props: Record<string, unknown>, ...children: unknown[]) => ({
      type,
      props: { 
        ...props, 
        children: children.length <= 1 ? children[0] : children 
      }
    }),
    Fragment: 'React.Fragment'
  },
  __capture: (line: number, value: unknown) => {
    if (value === undefined && !workerData.advanced?.showUndefined) {
      return value;
    }

    if (shouldDisplayExpression(value)) {
      if (isSyncPhase) {
        // Initial pass: send as Match Lines result
        parentPort?.postMessage({
          type: 'capture',
          payload: {
            line,
            value: serializeValue(value)
          }
        });
      } else {
        // Asynchronous pass: redirect to console output
        parentPort?.postMessage({
          type: 'log',
          payload: {
            type: 'log',
            value: [serializeValue(value)],
            timestamp: Date.now(),
            line,
            isCaptured: true
          }
        });
      }
    }

    return value; // Return result for chains
  }
};

// If CWD is provided, we allow requiring local modules
if (workerData.cwd && typeof workerData.cwd === 'string') {
  try {
    const customRequire = createRequire(path.join(workerData.cwd, 'index.js'));
    sandbox.require = customRequire;
    sandbox.__dirname = workerData.cwd;
    sandbox.__filename = path.join(workerData.cwd, 'scratchpad.js');
  } catch (err) {
    console.error('[Worker] Failed to setup CWD:', err);
  }
}

const context = vm.createContext(sandbox);

try {
  // Execute the script
  const script = new vm.Script(workerData.code);
  const result = script.runInContext(context, {
    displayErrors: true,
  });

  // Signal that synchronous execution is complete. 
  // Any further captures will be treated as async console logs.
  isSyncPhase = false;

  // Notify the parent of the synchronous return value (serialized)
  parentPort?.postMessage({
    type: 'result',
    payload: {
      success: true,
      result: serializeValue(result)
    }
  });

} catch (e: unknown) {
  isSyncPhase = false; // Ensure it's false even on error
  parentPort?.postMessage({
    type: 'result',
    payload: {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined
    }
  });
}
