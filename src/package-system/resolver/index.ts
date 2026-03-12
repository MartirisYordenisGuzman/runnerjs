/**
 * Resolver Architecture Stub
 * 
 * Maps ES module imports detected in user code (via Babel/AST or Regex)
 * to actual local paths. Used to intercept and rewrite imports inside
 * the sandboxed environment before execution.
 */
export interface DependencyResolver {
  resolveImport(importStatement: string): Promise<string>;
  detectImports(code: string): string[];
}
