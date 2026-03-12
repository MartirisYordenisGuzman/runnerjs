import { parentPort, workerData } from 'worker_threads';
import vm from 'vm';
import util from 'util';
import { createRequire } from 'module';
import * as path from 'path';

// Replace console to send messages back to the parent thread
const createInterceptedConsole = () => {
  const customConsole: Partial<Console> = {};

  const captureMethod = (type: string) => {
    return (...args: unknown[]) => {
      const serializedArgs = args.map(arg => {
        try {
          if (typeof arg === 'object') {
            return util.inspect(arg, { depth: 3, colors: false });
          }
          return arg;
        } catch {
          return '[Unserializable]';
        }
      });

      parentPort?.postMessage({
        type: 'log',
        payload: {
          type,
          value: serializedArgs,
          timestamp: Date.now()
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
};

// If CWD is provided, we allow requiring local modules
if (workerData.cwd) {
  const customRequire = createRequire(path.join(workerData.cwd, 'index.js'));
  sandbox.require = customRequire;
  sandbox.__dirname = workerData.cwd;
  sandbox.__filename = path.join(workerData.cwd, 'scratchpad.js');
}

const context = vm.createContext(sandbox);

try {
  // Execute the script
  const script = new vm.Script(workerData.code);
  const result = script.runInContext(context, {
    displayErrors: true,
  });

  // Native Promise resolution detection to keep the worker alive if needed,
  // but since RunJS typically returns immediately while intervals continue,
  // we notify the parent of the synchronous return value but DON'T exit.
  parentPort?.postMessage({
    type: 'result',
    payload: {
      success: true,
      result: result
    }
  });

} catch (e: unknown) {
  parentPort?.postMessage({
    type: 'result',
    payload: {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined
    }
  });
}
