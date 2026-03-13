import { Worker } from 'worker_threads';
import * as path from 'path';
import { transform as sucraseTransform } from 'sucrase';
import * as Babel from '@babel/standalone';
import type { ExecutionCompleteMessage, AppSettings } from '../../shared/ipc';
import { emitExecutionComplete, emitConsoleLog, emitWorkerStatus } from '../../core/event-bus';

// Module-level variable to ensure it's a true singleton across the Main process.
let activeWorker: Worker | null = null;

/**
 * Manages the sandbox execution and enforces security limits.
 * Uses worker_threads to allow terminating long-running sync or async loops.
 */
export class SandboxService {

  /**
   * Phase 1: Core Transformation (TS, JSX, Proposals)
   * Uses Sucrase for speed or Babel for experimental features.
   */
  private static transformPhase(code: string, buildSettings: AppSettings['build']): string {
    const hasProposals = Object.values(buildSettings?.proposals || {}).some(v => v === true);

    if (!hasProposals) {
      // Fast path: Sucrase
      const transforms: string[] = ['imports'];
      if (buildSettings?.transform?.typescript) transforms.push('typescript');
      if (buildSettings?.transform?.jsx) transforms.push('jsx');

      const result = sucraseTransform(code, {
        transforms: transforms as ('imports' | 'typescript' | 'jsx')[],
        jsxRuntime: 'classic',
        production: false
      });
      return result.code;
    }

    // Babel path for proposals
    const plugins = this.buildBabelPlugins(buildSettings?.proposals);
    const presets = ['env'];
    if (buildSettings?.transform?.typescript) presets.push('typescript');
    if (buildSettings?.transform?.jsx) presets.push('react');

    const result = Babel.transform(code, {
      filename: 'sandbox.tsx',
      presets,
      plugins,
      parserOpts: {
        plugins: this.getBabelParserPlugins(buildSettings?.proposals)
      },
      generatorOpts: {
        retainLines: true
      },
      sourceType: 'module'
    });

    return result.code || '';
  }

  /**
   * Phase 2: Runtime Instrumentation (Loop Protection, Expression Capture)
   * Always uses Babel for precise AST manipulation on the generated JS.
   */
  private static instrumentationPhase(code: string, advancedSettings: AppSettings['advanced']): string {
    const plugins: any[] = [];

    // Loop Protection
    if (advancedSettings?.loopProtection) {
      plugins.push(({ types: t }: any) => ({
        visitor: {
          "WhileStatement|ForStatement|DoWhileStatement|ForInStatement|ForOfStatement"(path: any) {
            const id = Math.random().toString(36).slice(2, 7);
            const start = t.identifier(`__loopStart_${id}`);
            const counter = t.identifier(`__loopIter_${id}`);
            
            const setup = t.variableDeclaration('let', [
              t.variableDeclarator(start, t.callExpression(t.memberExpression(t.identifier('Date'), t.identifier('now')), [])),
              t.variableDeclarator(counter, t.numericLiteral(0))
            ]);

            path.insertBefore(setup);
            
            const check = t.ifStatement(
              t.logicalExpression('&&',
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

    // Expression Results & Match Lines
    if (advancedSettings?.expressionResults || advancedSettings?.matchLines) {
      plugins.push(({ types: t }: any) => ({
        visitor: {
          CallExpression(path: any) {
            const callee = path.node.callee;

            // 1. Do NOT instrument CallExpression arguments to avoid deep noise
            path.get('arguments').forEach((argPath: any) => argPath.skip());

            // 2. Inject line number for console logs
            if (
              t.isMemberExpression(callee) &&
              t.isIdentifier(callee.object) &&
              callee.object.name === 'console' &&
              t.isIdentifier(callee.property) &&
              ['log', 'warn', 'error', 'info', 'debug'].includes(callee.property.name)
            ) {
              const line = path.node.loc?.start.line || 0;
              if (line > 0) {
                path.node.arguments.unshift(
                  t.objectExpression([
                    t.objectProperty(t.identifier('__runner_line'), t.numericLiteral(line))
                  ])
                );
              }
            }
          },
          ExpressionStatement(path: any) {
            // Only capture top-level expressions and when expressionResults is on
            if (advancedSettings?.expressionResults && path.parentPath.isProgram()) {
              const expr = path.node.expression;
              
              // Skip internal calls and noisy globals
              if (t.isCallExpression(expr)) {
                const callee = expr.callee;
                if (t.isIdentifier(callee)) {
                   if (['__capture', 'setInterval', 'setTimeout', 'clearInterval', 'clearTimeout'].includes(callee.name)) return;
                }
                if (t.isMemberExpression(callee) && t.isIdentifier(callee.object) && callee.object.name === 'console') return;
              }

              const line = path.node.loc?.start.line || 0;
              if (line === 0) return;

              // SequenceExpression strategy: (__capture(line, expr))
              path.replaceWith(t.expressionStatement(
                t.callExpression(t.identifier('__capture'), [
                  t.numericLiteral(line),
                  expr
                ])
              ));
              path.skip();
            }
          }
        }
      }));
    }

    const result = Babel.transform(code, {
      filename: 'instrumented.js',
      plugins,
      retainLines: true,
      sourceType: 'unambiguous'
    });

    return result.code || '';
  }

  private static buildBabelPlugins(proposals: AppSettings['build']['proposals']): any[] {
    const plugins: any[] = [];
    const available = (Babel as any).availablePlugins || {};

    if (proposals?.decorators) {
      // Use version: 'legacy' as it's the most common for scratchpads
      plugins.push(['proposal-decorators', { version: 'legacy' }]);
      plugins.push(['transform-class-properties', { loose: true }]);
      plugins.push(['transform-private-methods', { loose: true }]);
      plugins.push(['transform-private-property-in-object', { loose: true }]);
    }

    if (proposals?.doExpressions) plugins.push('proposal-do-expressions');
    if (proposals?.functionSent) plugins.push('proposal-function-sent');
    if (proposals?.pipelineOperator) plugins.push(['proposal-pipeline-operator', { proposal: 'minimal' }]);
    if (proposals?.throwExpressions) plugins.push('proposal-throw-expressions');
    if (proposals?.regexpModifiers) plugins.push('transform-regexp-modifiers');
    if (proposals?.optionalChaining) plugins.push('proposal-optional-chaining');

    // Filter to ensure only existing plugins are used
    return plugins.filter(p => {
      const name = Array.isArray(p) ? p[0] : p;
      return !!available[name];
    });
  }

  private static getBabelParserPlugins(proposals: AppSettings['build']['proposals']): any[] {
    const plugins: any[] = ['jsx', 'typescript'];
    if (proposals?.decorators) plugins.push('decorators-legacy');
    if (proposals?.doExpressions) plugins.push('doExpressions');
    if (proposals?.pipelineOperator) plugins.push(['pipelineOperator', { proposal: 'minimal' }]);
    if (proposals?.throwExpressions) plugins.push('throwExpressions');
    if (proposals?.functionSent) plugins.push('functionSent');
    if (proposals?.optionalChaining) plugins.push('optionalChaining');
    if (proposals?.partialApplication) plugins.push('partialApplication');
    return plugins;
  }

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
    let finalCode = code;

    try {
      // Defensive pre-processing for ASI issues
      code = code.replace(/^(\s*)([[(])/gm, '$1;$2');

      // Phase 1: Transform
      const transformed = this.transformPhase(code, buildSettings);
      
      // Phase 2: Instrumentation
      finalCode = this.instrumentationPhase(transformed, advancedSettings);

    } catch (err: any) {
      console.error('[SandboxService] Pipeline failed:', err);
      emitWorkerStatus('stopped');
      return { 
        success: false, 
        error: `Transformation Error: ${err.message}`,
        executionTimeMs: 0 
      };
    }

    // Stop any existing execution and wait for it to fully exit (silently)
    await this.stop(true);
    
    const start = performance.now();

    return new Promise((resolve) => {
      // In production/dev-electron the built worker file is standard CJS
      const workerPath = path.join(__dirname, 'worker.js');

      console.log('[SandboxService] Spawning worker...');
      const worker = new Worker(workerPath, {
        workerData: { 
          code: finalCode, // Fixed: use finalCode instead of transformedCode
          cwd: typeof cwd === 'string' ? cwd : undefined, 
          env,
          advanced: advancedSettings
        },
      });
      activeWorker = worker;

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
        console.error('[SandboxService] Worker error:', err);
        if (resolved) return;
        resolved = true;
        
        if (activeWorker === worker) {
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
        console.log(`[SandboxService] Worker exited with code ${code}`);
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
        if (activeWorker === worker) {
          emitWorkerStatus('stopped');
          activeWorker = null;
        }
      });
    });
  }

  /**
   * Forcibly terminates the currently running worker thread.
   */
  static async stop(silent: boolean = false) {
    if (activeWorker) {
      console.log('[SandboxService] Terminating active worker...');
      const workerToStop = activeWorker;
      
      // Emit a console log informing the user (if not silent)
      if (!silent) {
        emitConsoleLog({
           type: 'warn',
           value: ['[Process Terminated]'],
           timestamp: Date.now()
        });
      }

      await workerToStop.terminate();
      console.log('[SandboxService] Worker terminated successfully.');
      
      // Ensure it's cleared if still matching
      if (activeWorker === workerToStop) {
        activeWorker = null;
        emitWorkerStatus('stopped');
      }
    } else {
      console.log('[SandboxService] Stop requested but no active worker found.');
    }
  }
}
