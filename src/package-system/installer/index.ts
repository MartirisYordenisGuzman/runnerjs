/**
 * Installer Architecture Stub
 * 
 * Handles downloading NPM packages on the fly using `npm install` 
 * or directly via NPM registry HTTP calls.
 */
export interface PackageInstaller {
  installPackage(packageName: string, version?: string): Promise<boolean>;
  getInstallStatus(packageName: string): 'uninstalled' | 'installing' | 'installed';
}
