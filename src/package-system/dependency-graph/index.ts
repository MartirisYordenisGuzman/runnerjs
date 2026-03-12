/**
 * Dependency Graph stub
 * 
 * Future system to resolve nested node_modules dependencies
 * required by the executing sandbox. 
 * Allows creating a flat mapping of require paths for the runtime.
 */
export interface DependencyGraph {
  buildGraph(entryPackage: string): Promise<Record<string, string>>;
}
