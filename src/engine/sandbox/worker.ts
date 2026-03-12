import { parentPort, workerData } from 'worker_threads';
import vm from 'vm';
import { createRequire } from 'module';
import * as path from 'path';

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

      // Send raw data to allow the frontend to handle syntax highlighting
      const processedArgs = finalArgs.map(arg => {
        if (arg === null || arg === undefined || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string') {
          return arg;
        }
        try {
          if (typeof arg === 'object') {
            return arg; 
          }
          return String(arg);
        } catch {
          return '[Unserializable]';
        }
      });

      parentPort?.postMessage({
        type: 'log',
        payload: {
          type,
          value: processedArgs,
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
    parentPort?.postMessage({
      type: 'capture',
      payload: {
        line,
        value: value // Send raw value
      }
    });
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
