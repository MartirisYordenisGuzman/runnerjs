import { ChildProcess, fork } from 'child_process';
import * as path from 'path';
import { transform as sucraseTransform } from 'sucrase';
import * as Babel from '@babel/standalone';
import type { ExecutionCompleteMessage, AppSettings } from '../../shared/ipc';
import { emitExecutionComplete, emitConsoleLog, emitWorkerStatus, emitConsoleClear } from '../../core/event-bus';

// Module-level variable to ensure it's a true singleton across the Main process.
let activeProcess: ChildProcess | null = null;

/**
 * Manages the sandbox execution and enforces security limits.
 * Uses child_process.fork to execute user code in a dedicated Node.js process.
 */
export class SandboxService {

  /**
   * Phase 1: Core Transformation (TS, JSX, Proposals)
   */
  private static transformPhase(code: string, buildSettings: AppSettings['build']): string {
    const hasProposals = Object.values(buildSettings?.proposals || {}).some(v => v === true);

    if (!hasProposals) {
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
   */
  private static instrumentationPhase(code: string, advancedSettings: AppSettings['advanced']): string {
    const plugins: any[] = [];

    if (advancedSettings?.loopProtection) {
      plugins.push(({ types: t }: { types: any }) => ({
        visitor: {
          "WhileStatement|ForStatement|DoWhileStatement|ForInStatement|ForOfStatement"(path: any) {
            const line = path.node.loc?.start.line || 0;
            const check = t.ifStatement(
              t.callExpression(t.identifier('__loopGuard'), line > 0 ? [t.numericLiteral(line)] : []),
              t.breakStatement()
            );

            if (path.get('body').isBlockStatement()) {
              path.get('body').unshiftContainer('body', check);
            } else {
              path.get('body').replaceWith(t.blockStatement([check, path.node.body]));
            }
          },
          "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ObjectMethod|ClassMethod"(path: any) {
            const line = path.node.loc?.start.line || 0;
            const check = t.ifStatement(
              t.callExpression(t.identifier('__checkCall'), line > 0 ? [t.numericLiteral(line)] : []),
              t.returnStatement()
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
      plugins.push(({ types: t }: { types: any }) => ({
        visitor: {
          CallExpression(path: any) {
            const callee = path.node.callee;
            path.get('arguments').forEach((argPath: any) => argPath.skip());

            if (
              t.isMemberExpression(callee) &&
              t.isIdentifier(callee.object) &&
              callee.object.name === 'console' &&
              t.isIdentifier(callee.property) &&
              ['log', 'warn', 'error', 'info', 'debug', 'table', 'dir', 'time', 'timeEnd', 'group', 'groupEnd'].includes(callee.property.name)
            ) {
              const line = path.node.loc?.start.line || 0;
              if (line > 0) {
                path.node.arguments.unshift(
                  t.objectExpression([
                    t.objectProperty(t.identifier('__runner_metadata__'), t.objectExpression([
                      t.objectProperty(t.identifier('line'), t.numericLiteral(line))
                    ]))
                  ])
                );
              }
            }
          },
          ExpressionStatement(path: any) {
            if (advancedSettings?.expressionResults && path.parentPath.isProgram()) {
              const expr = path.node.expression;
              
              if (t.isCallExpression(expr)) {
                const callee = expr.callee;
                if (t.isIdentifier(callee)) {
                   if (['__capture', 'setInterval', 'setTimeout', 'clearInterval', 'clearTimeout'].includes(callee.name)) return;
                }
                if (t.isMemberExpression(callee) && t.isIdentifier(callee.object) && callee.object.name === 'console') return;
              }

              const line = path.node.loc?.start.line || 0;
              if (line === 0) return;

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
   * Evaluates the given code securely in a separate Node.js process.
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
      code = code.replace(/^(\s*)([[(])/gm, '$1;$2');
      const transformed = this.transformPhase(code, buildSettings);
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

    await this.stop(true);
    
    const start = performance.now();

    return new Promise((resolve) => {
      // In production/dev-electron the built runtime file is handled by Electron-Vite
      const runtimePath = path.join(__dirname, 'runtime.js');

      console.log('[SandboxService] Spawning subprocess...');
      const child = fork(runtimePath, [], {
        cwd: typeof cwd === 'string' ? cwd : undefined,
        env: { ...process.env, ...env },
        stdio: 'pipe'
      });
      activeProcess = child;

      emitWorkerStatus('running');

      let resolved = false;
      let logCount = 0;
      const MAX_LOGS = 1000;

      // Hard timeout for the entire process (Level 2 protection)
      const timeout = setTimeout(() => {
        if (!resolved) {
          console.warn('[SandboxService] Execution timed out (Hard Limit)');
          this.stop(false); // Send warm warning the process was terminated
          resolved = true;
          const end = performance.now();
          const payload: ExecutionCompleteMessage = {
            success: false,
            error: 'Execution timed out (5s limit exceeded)',
            executionTimeMs: Math.round(end - start)
          };
          emitExecutionComplete(payload);
          resolve(payload);
        }
      }, 5000);

      child.on('message', (message: { type: string, payload: any }) => {
        if (message.type === 'log') {
          logCount++;
          if (logCount > MAX_LOGS) {
            if (logCount === MAX_LOGS + 1) {
              emitConsoleLog({
                type: 'warn',
                value: ['[Console floouding detected] Log skipped to prevent UI freeze.'],
                timestamp: Date.now()
              });
            }
            return;
          }
          emitConsoleLog(message.payload);
        } else if (message.type === 'capture') {
          logCount++;
          if (logCount > MAX_LOGS) return; // Silent for captures

          emitConsoleLog({
            type: 'log',
            value: [message.payload.value],
            timestamp: Date.now(),
            line: message.payload.line,
            isCaptured: true
          });
        } else if (message.type === 'clear') {
          emitConsoleClear();
        } else if (message.type === 'result') {
          resolved = true;
          clearTimeout(timeout);
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

      child.on('error', (err) => {
        console.error('[SandboxService] Subprocess error:', err);
        if (resolved) return;
        resolved = true;
        
        if (activeProcess === child) {
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

      child.on('exit', (code) => {
        console.log(`[SandboxService] Subprocess exited with code ${code}`);
        
        if (!resolved) {
          resolved = true;
          resolve({
             success: true,
             result: undefined,
             executionTimeMs: Math.round(performance.now() - start)
          });
        }

        if (activeProcess === child) {
          emitWorkerStatus('stopped');
          activeProcess = null;
        }
      });

      // Start execution
      child.send({
        type: 'execute',
        code: finalCode,
        cwd,
        env,
        advanced: advancedSettings
      });
    });
  }

  /**
   * Forcibly terminates the currently running subprocess.
   */
  static async stop(silent: boolean = false) {
    if (activeProcess) {
      console.log('[SandboxService] Terminating active subprocess...');
      const processToStop = activeProcess;
      
      if (!silent) {
        emitConsoleLog({
           type: 'warn',
           value: ['[Process Terminated]'],
           timestamp: Date.now()
        });
      }

      processToStop.kill('SIGKILL');
      
      if (activeProcess === processToStop) {
        activeProcess = null;
        emitWorkerStatus('stopped');
      }
    }
  }
}
