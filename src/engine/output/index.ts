import util from 'util';
import type { ConsoleLogMessage } from '../../shared/ipc';
import { emitConsoleLog } from '../../core/event-bus';

/**
 * Creates a proxied console object that captures standard output 
 * and routes it to the Event Bus while still strictly bounding types.
 */
export function createInterceptedConsole(): Console {
  const customConsole: Partial<Console> = {};

  const captureMethod = (type: ConsoleLogMessage['type']) => {
    return (...args: any[]) => {
      // Convert raw objects to strings to avoid VM object reference issues 
      // when passing from Sandbox to Main
      const serializedArgs = args.map(arg => {
        try {
          if (typeof arg === 'object') {
            return util.inspect(arg, { depth: 3, colors: false });
          }
          return arg;
        } catch (e) {
          return '[Unserializable]';
        }
      });

      emitConsoleLog({
        type,
        value: serializedArgs,
        timestamp: Date.now()
      });
    };
  };

  customConsole.log = captureMethod('log');
  customConsole.warn = captureMethod('warn');
  customConsole.error = captureMethod('error');
  customConsole.info = captureMethod('info');
  customConsole.debug = captureMethod('debug');
  
  // Basic unsupported stubs
  customConsole.clear = () => {};
  customConsole.table = captureMethod('log');

  return customConsole as Console;
}
