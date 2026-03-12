import { Worker } from 'worker_threads';
import * as path from 'path';
import { transform as sucraseTransform } from 'sucrase';
import * as Babel from '@babel/standalone';
import type { ExecutionCompleteMessage, AppSettings } from '../../shared/ipc';
import { emitExecutionComplete, emitConsoleLog, emitWorkerStatus } from '../../core/event-bus';


/**
 * Manages the sandbox execution and enforces security limits.
 * Uses worker_threads to allow terminating long-running sync or async loops.
 */
export class SandboxService {
  private static activeWorker: Worker | null = null;

  /**
   * Evaluates the given code securely in a separate thread.
   * @param code Raw string (possibly TS/JSX)
   * @param buildSettings Settings to determine transformation
   * @param cwd Optional working directory
   * @param env Optional environment variables
   */
  static async execute(
    code: string, 
    buildSettings: AppSettings['build'],
    advancedSettings: AppSettings['advanced'],
    cwd?: string, 
    env?: Record<string, string>
  ): Promise<ExecutionCompleteMessage> {
    // 1. Transform code based on settings
    let transformedCode = code;
    try {
      // Determine if we need Babel (for experimental proposals) or if Sucrase is enough
      // Note: partialApplication is NOT included — the plugin is absent from the bundle
      const needsBabel = 
        buildSettings?.proposals?.doExpressions ||
        buildSettings?.proposals?.functionSent ||
        buildSettings?.proposals?.pipelineOperator ||
        buildSettings?.proposals?.throwExpressions ||
        buildSettings?.proposals?.regexpModifiers ||
        advancedSettings?.loopProtection ||
        advancedSettings?.expressionResults ||
        advancedSettings?.matchLines ||
        (buildSettings?.proposals?.decorators && !buildSettings?.transform?.typescript);

      // Warn the user early if they have enabled a proposal that's not supported
      if (buildSettings?.proposals?.partialApplication) {
        emitConsoleLog({
          type: 'warn',
          value: ['[Proposal] Partial Application (?): not included in this Babel bundle. Disable it or remove the ? syntax from your code to avoid transformation errors.'],
          timestamp: Date.now()
        });
      }

      // Pre-process: Insert defensive semicolons before lines starting with
      // [ or ( to prevent ASI from merging them with the previous expression.
      // Without this, `user.role\n[1,2,3].map()` is parsed as
      // `user.role[1,2,3].map()` (bracket property access).
      code = code.replace(/^(\s*)([[(])/gm, '$1;$2');

      if (needsBabel) {
        console.log('[SandboxService] Using Babel for experimental proposals');
        const plugins: any[] = [];
        
        // Babel Standalone uses strings for built-in plugins
        // These names are confirmed via Babel.availablePlugins
        if (buildSettings?.proposals?.decorators) {
          // proposal-decorators must come BEFORE class-properties transforms
          // version: 'legacy' is the correct option (not { legacy: true })
          plugins.push(['proposal-decorators', { version: 'legacy' }]);
          plugins.push(['transform-class-properties', { loose: true }]);
          plugins.push(['transform-private-methods', { loose: true }]);
          plugins.push(['transform-private-property-in-object', { loose: true }]);
        }
        if (buildSettings?.proposals?.doExpressions) {
          plugins.push('proposal-do-expressions');
        }
        if (buildSettings?.proposals?.functionSent) {
          plugins.push('proposal-function-sent');
        }
        if (buildSettings?.proposals?.pipelineOperator) {
          plugins.push(['proposal-pipeline-operator', { proposal: 'minimal' }]);
        }
        // partialApplication: omitted — not in the bundle, handled by the warning above
        if (buildSettings?.proposals?.throwExpressions) {
          plugins.push('proposal-throw-expressions');
        }
        if (buildSettings?.proposals?.regexpModifiers) {
          plugins.push('transform-regexp-modifiers');
        }

        const presets = ['env'];
        if (buildSettings?.transform?.typescript) presets.push('typescript');
        if (buildSettings?.transform?.jsx) presets.push('react');

        // Robust plugin filtering: Only use plugins actually available in this Babel distribution
        const availablePlugins = (Babel as any).availablePlugins || {};
        const safePlugins = plugins.filter(p => {
          const name = Array.isArray(p) ? p[0] : p;
          return !!availablePlugins[name];
        });

        // Build parser plugins list — must match what's enabled in transform plugins
        const parserPlugins: any[] = ['jsx', 'typescript'];
        if (buildSettings?.proposals?.decorators) {
          // When using proposal-decorators with legacy, parser needs 'decorators-legacy'
          parserPlugins.push('decorators-legacy');
        }
        if (buildSettings?.proposals?.doExpressions) parserPlugins.push('doExpressions');
        if (buildSettings?.proposals?.pipelineOperator) {
          parserPlugins.push(['pipelineOperator', { proposal: 'minimal' }]);
        }
        if (buildSettings?.proposals?.throwExpressions) parserPlugins.push('throwExpressions');
        if (buildSettings?.proposals?.functionSent) parserPlugins.push('functionSent');

        // Advanced Plugins
        if (advancedSettings?.loopProtection) {
          safePlugins.push(({ types: t }: any) => ({
            visitor: {
              "WhileStatement|ForStatement|DoWhileStatement|ForInStatement|ForOfStatement"(path: any) {
                const start = t.identifier('__loopStart_' + Math.random().toString(36).slice(2, 7));
                const setup = t.variableDeclaration('let', [
                  t.variableDeclarator(start, t.callExpression(t.memberExpression(t.identifier('Date'), t.identifier('now')), []))
                ]);
                
                // Add an iteration counter for performance
                const counter = t.identifier('__loopIter_' + Math.random().toString(36).slice(2, 7));
                const counterSetup = t.variableDeclaration('let', [
                  t.variableDeclarator(counter, t.numericLiteral(0))
                ]);

                path.insertBefore([setup, counterSetup]);
                
                // Check every 100 iterations or if more than 2 seconds passed
                const check = t.ifStatement(
                  t.binaryExpression('&&',
                    t.binaryExpression('===', t.binaryExpression('%', t.updateExpression('++', counter), t.numericLiteral(100)), t.numericLiteral(0)),
                    t.binaryExpression('>', t.binaryExpression('-', t.callExpression(t.memberExpression(t.identifier('Date'), t.identifier('now')), []), start), t.numericLiteral(2000))
                  ),
                  t.throwStatement(t.newExpression(t.identifier('Error'), [t.stringLiteral('Execution timed out (Loop Protection)')]))
                );

                if (path.get('body').isBlockStatement()) {
                  path.get('body').unshiftContainer('body', check);
                } else {
                  path.get('body').replaceWith(t.blockStatement([check, path.node.body]));
                }
              }
            }
          }));
        }

        if (advancedSettings?.expressionResults || advancedSettings?.matchLines) {
          // Plugin 1: Inject line numbers into console calls
          safePlugins.push(({ types: t }: any) => ({
            visitor: {
              CallExpression(path: any) {
                const callee = path.node.callee;
                if (
                  t.isMemberExpression(callee) &&
                  t.isIdentifier(callee.object) &&
                  callee.object.name === 'console' &&
                  t.isIdentifier(callee.property) &&
                  ['log', 'warn', 'error', 'info', 'debug'].includes(callee.property.name)
                ) {
                  // Prepend { __runner_line: N } as the first argument
                  let line = path.node.loc?.start.line || 0;
                  
                  // Fallback: Calculate line number manually if Babel's loc is missing
                  if (line === 0 && typeof path.node.start === 'number' && typeof code === 'string') {
                    line = code.substring(0, path.node.start).split('\n').length;
                  }

                  if (line > 0) {
                    path.node.arguments.unshift(
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier('__runner_line'),
                          t.numericLiteral(line)
                        )
                      ])
                    );
                  }
                }
              }
            }
          }));
        }

        if (advancedSettings?.expressionResults) {
          // Plugin 2: Capture expression results
          safePlugins.push(({ types: t }: any) => ({
            visitor: {
              ExpressionStatement(path: any) {
                if (path.parentPath.isProgram()) {
                  const expression = path.node.expression;
                  // Don't capture our own internal __capture calls or console calls (which now have metadata)
                  if (t.isCallExpression(expression)) {
                    const callee = expression.callee;
                    if (t.isIdentifier(callee) && callee.name === '__capture') return;
                    if (t.isMemberExpression(callee) && t.isIdentifier(callee.object) && callee.object.name === 'console') return;
                  }
                  
                  const line = path.node.loc?.start.line || 0;
                  path.replaceWith(t.expressionStatement(
                    t.callExpression(t.identifier('__capture'), [
                      t.numericLiteral(line),
                      expression
                    ])
                  ));
                }
              }
            }
          }));
        }

        const result = Babel.transform(code, {
          filename: 'sandbox.tsx',
          presets,
          plugins: safePlugins,
          parserOpts: {
            plugins: parserPlugins
          },
          generatorOpts: {
            retainLines: true
          },
          sourceType: 'module'
        });
        transformedCode = result.code || '';
      } else {
        // Use Sucrase for speed for standard TS/JSX
        const transforms: string[] = ['imports'];
        if (buildSettings?.transform?.typescript) transforms.push('typescript');
        if (buildSettings?.transform?.jsx) transforms.push('jsx');
        
        const result = sucraseTransform(code, {
          transforms: transforms as ('imports' | 'typescript' | 'jsx')[],
          jsxRuntime: 'classic', 
          production: false
        });
        transformedCode = result.code;
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[SandboxService] Transformation failed:', error);
      
      // Detect partialApplication parser error (? syntax) and give a clear message
      const isPartialAppError = error.message?.includes("'partialApplication'") || 
                                error.message?.includes('partialApplication');
      if (isPartialAppError) {
        return {
          success: false,
          error: `Partial Application (?): This proposal is not supported in the current Babel bundle.\n\nDisable the "Partial Application" checkbox in Settings, or remove the "?" syntax from your code.\n\nExample: replace "multiply(3, ?)" with a regular call like "multiply.bind(null, 3)".`,
          executionTimeMs: 0
        };
      }

      return { 
        success: false, 
        error: `Transformation Error: ${error.message}`,
        executionTimeMs: 0 

      };
    }

    // Stop any existing execution and wait for it to fully exit (silently)
    await this.stop(true);
    
    const start = performance.now();

    return new Promise((resolve) => {
      // In production/dev-electron the built worker file is standard CJS
      const workerPath = path.join(__dirname, 'worker.js');

      const worker = new Worker(workerPath, {
        workerData: { 
          code: transformedCode, 
          cwd: typeof cwd === 'string' ? cwd : undefined, 
          env,
          advanced: advancedSettings
        },
      });
      SandboxService.activeWorker = worker;

      emitWorkerStatus('running');

      let resolved = false;

      worker.on('message', (message) => {
        if (message.type === 'log') {
          emitConsoleLog(message.payload);
        } else if (message.type === 'capture') {
          emitConsoleLog({
            type: 'log',
            value: [message.payload.value],
            timestamp: Date.now(),
            line: message.payload.line, // Pass line number for Match Lines feature
            isCaptured: true
          });
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
