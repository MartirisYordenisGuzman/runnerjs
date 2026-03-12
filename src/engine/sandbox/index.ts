import { Worker } from 'worker_threads';
import * as path from 'path';
import type { ExecutionCompleteMessage } from '../../shared/ipc';
import { emitExecutionComplete, emitConsoleLog, emitWorkerStatus } from '../../core/event-bus';


/**
 * Manages the sandbox execution and enforces security limits.
 * Uses worker_threads to allow terminating long-running sync or async loops.
 */
export class SandboxService {
  private static activeWorker: Worker | null = null;

  /**
   * Evaluates the given code securely in a separate thread.
   * @param code Raw JavaScript string
   * @param cwd Optional working directory
   * @param env Optional environment variables
   */
  static async execute(code: string, cwd?: string, env?: Record<string, string>): Promise<ExecutionCompleteMessage> {
    // Stop any existing execution and wait for it to fully exit (silently)
    await this.stop(true);
    
    const start = performance.now();

    return new Promise((resolve) => {
      // In production/dev-electron the built worker file is standard CJS
      const workerPath = path.join(__dirname, 'worker.js');

      const worker = new Worker(workerPath, {
        workerData: { code, cwd, env },
      });
      SandboxService.activeWorker = worker;

      emitWorkerStatus('running');

      let resolved = false;

      worker.on('message', (message) => {
        if (message.type === 'log') {
          emitConsoleLog(message.payload);
        } else if (message.type === 'result') {
          resolved = true;
          const end = performance.now();
          const executionTimeMs = Math.round(end - start);
          const payload: ExecutionCompleteMessage = {
            ...message.payload,
            executionTimeMs
          };
          emitExecutionComplete(payload);
          resolve(payload);
        }
      });

      worker.on('error', (err) => {
        if (resolved) return;
        resolved = true;
        
        if (SandboxService.activeWorker === worker) {
          emitWorkerStatus('stopped');
        }

        const end = performance.now();
        const payload: ExecutionCompleteMessage = {
          success: false,
          error: err.message || String(err),
          executionTimeMs: Math.round(end - start)
        };
        emitExecutionComplete(payload);
        resolve(payload);
      });

      worker.on('exit', (code) => {
        if (code !== 0 && code !== 1) {
          console.error(`Worker stopped with exit code ${code}`);
        }
        
        if (!resolved) {
          resolved = true;
          resolve({
             success: true,
             result: undefined,
             executionTimeMs: Math.round(performance.now() - start)
          });
        }

        // Only emit 'stopped' and clear if this is still the active worker
        if (SandboxService.activeWorker === worker) {
          emitWorkerStatus('stopped');
          SandboxService.activeWorker = null;
        }
      });
    });
  }

  /**
   * Forcibly terminates the currently running worker thread.
   */
  static async stop(silent: boolean = false) {
    if (SandboxService.activeWorker) {
      const workerToStop = SandboxService.activeWorker;
      
      // Emit a console log informing the user (if not silent)
      if (!silent) {
        emitConsoleLog({
           type: 'warn',
           value: ['[Process Terminated]'],
           timestamp: Date.now()
        });
      }

      await workerToStop.terminate();
      
      // Ensure it's cleared if still matching
      if (SandboxService.activeWorker === workerToStop) {
        SandboxService.activeWorker = null;
        emitWorkerStatus('stopped');
      }
    }
  }
}
