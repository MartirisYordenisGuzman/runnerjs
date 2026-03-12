import vm from 'vm';
import { createInterceptedConsole } from '../output';

/**
 * Prepares the secure context for code execution.
 * Exposes only safe global APIs.
 */
export function createRuntimeContext(): vm.Context {
  const safeConsole = createInterceptedConsole();
  
  // Define safe subset of globals
  const sandbox = {
    console: safeConsole,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    URL: URL,
    Buffer: Buffer,
    fetch: typeof fetch !== 'undefined' ? fetch : undefined, // Native fetch if Node 18+
  };

  // Compile sandbox to a vm Context
  return vm.createContext(sandbox);
}
