import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as https from 'https';

import { SandboxService } from '../src/engine/sandbox';
import { onConsoleLog, onWorkerStatus, onConsoleClear } from '../src/core/event-bus';
import { AppSettings, Snippet, SessionData } from '../src/shared/ipc';

let win: BrowserWindow | null = null;
const SESSION_FILE = path.join(app.getPath('userData'), 'session.json');

async function loadSessionData(): Promise<SessionData | null> {
  try {
    const data = await fs.readFile(SESSION_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveSessionData(session: SessionData) {
  try {
    await fs.writeFile(SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Main] Failed to save session:', err);
    return false;
  }
}

async function createWindow() {
  console.log('[Main] Creating window...');
  
  const session = await loadSessionData();
  const windowState = session?.windowState || {
    width: 1200,
    height: 800,
    isMaximized: false,
    isFullScreen: false,
    x: undefined as number | undefined,
    y: undefined as number | undefined
  };

  win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    frame: false,
    backgroundColor: '#1e1e1e', // Match app background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../src/assets/logo.png'),
  });

  // Remove default File, Edit, View application menu (using custom UI)
  Menu.setApplicationMenu(null);
  win.removeMenu();

  // Use Vite development server dynamically if available
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  console.log(`[Main] Loading URL: ${devUrl}`);

  if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
    win.loadURL(devUrl).catch((err) => {
      console.error('[Main] Failed to load URL:', err);
    });
    // win.webContents.openDevTools();

    // win.webContents.closeDevTools();

  } else {
    // Packaged production build
    const indexPath = path.join(__dirname, '../../dist/index.html');
    console.log(`[Main] Loading production file: ${indexPath}`);
    win.loadFile(indexPath).catch((err) => {
      console.error('[Main] Failed to load production file:', err);
    });
  }

  if (windowState.isMaximized) {
    win.maximize();
  }
  if (windowState.isFullScreen) {
    win.setFullScreen(true);
  }

  const saveWindowState = async () => {
    if (!win) return;
    const isMaximized = win.isMaximized();
    const isFullScreen = win.isFullScreen();
    
    // Use getNormalBounds if maximized/fullscreen to capture the restoration state
    // win.getNormalBounds() is the most reliable way to get the pre-maximized state
    let bounds: { x: number, y: number, width: number, height: number };
    try {
      bounds = (isMaximized || isFullScreen) ? (win as BrowserWindow).getNormalBounds() : win.getBounds();
    } catch {
      // Fallback if getNormalBounds fails (e.g. initial call before fully ready)
      bounds = win.getBounds();
    }
    
    // Re-read current session from disk to avoid using stale values from closure
    const currentSession = await loadSessionData() || {
      tabs: [],
      activeTabId: '',
      layout: { 
        sidebarVisible: true, 
        outputVisible: true, 
        layoutDirection: 'horizontal' as const,
        splitSizes: [50, 50]
      }
    };

    const newSession: SessionData = {
      ...currentSession,
      windowState: {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized,
        isFullScreen
      }
    };
    await saveSessionData(newSession);
  };

  win.on('resize', saveWindowState);
  win.on('move', saveWindowState);
  win.on('enter-full-screen', saveWindowState);
  win.on('leave-full-screen', saveWindowState);

  win.on('closed', () => {
    win = null;
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[Main] Page finished loading');
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Main] Page failed to load: ${errorDescription} (${errorCode})`);
  });
}

app.whenReady().then(() => {
  console.log('[Main] App ready');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Folder for local storage (Snippets, etc)
const SNIPPETS_FILE = path.join(app.getPath('userData'), 'snippets.json');

const readSnippets = async () => {
  try {
    const data = await fs.readFile(SNIPPETS_FILE, 'utf-8');
    return JSON.parse(data) as Snippet[];
  } catch {
    return [];
  }
};

const writeSnippets = async (snippets: Snippet[]) => {
  try {
    await fs.writeFile(SNIPPETS_FILE, JSON.stringify(snippets, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Main] Failed to write snippets:', err);
    return false;
  }
};

// Code Execution Handlers
ipcMain.handle('execute-code', async (_event, code: string, settings: { build: AppSettings['build'], advanced: AppSettings['advanced'] }, cwd?: string, env?: Record<string, string>) => {
  try {
    return await SandboxService.execute(code, settings.build, settings.advanced, cwd, env);
  } catch (err) {
    console.error('[Main] Execution error:', err);
    return { success: false, error: String(err), executionTimeMs: 0 };
  }
});

// Environment Variables Persistence
const ENV_VARS_FILE = path.join(app.getPath('userData'), 'env_vars.json');

ipcMain.handle('get-env-vars', async () => {
  try {
    const data = await fs.readFile(ENV_VARS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
});

ipcMain.handle('save-env-vars', async (_event, envVars: Record<string, string>) => {
  try {
    await fs.writeFile(ENV_VARS_FILE, JSON.stringify(envVars, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// App Settings Persistence
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

ipcMain.handle('get-settings', async (): Promise<AppSettings | null> => {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data) as AppSettings;
  } catch {
    return null; // Let the renderer decide default settings
  }
});

ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Session Persistence Handlers
ipcMain.handle('get-session', async () => {
  return await loadSessionData();
});

ipcMain.handle('save-session', async (_event, session: SessionData) => {
  // CRITICAL: Merge with existing data on disk to avoid overwriting windowState
  const existing = await loadSessionData() || {} as SessionData;
  const merged: SessionData = {
    ...existing,
    ...session,
    // Explicitly preserve windowState if not provided by renderer
    windowState: session.windowState || existing.windowState
  };
  const success = await saveSessionData(merged);
  return { success };
});

// NPM Package Management
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

ipcMain.handle('install-package', async (_event, name: string, cwd: string) => {
  console.log(`[Main] === START INSTALLATION ===`);
  console.log(`[Main] Target: ${name}, CWD: ${cwd}`);
  
  try {
    const absoluteCwd = path.resolve(cwd);
    
    // Ensure package.json exists
    const packageJsonPath = path.join(absoluteCwd, 'package.json');
    try {
      await fs.access(packageJsonPath);
      console.log(`[Main] package.json exists.`);
    } catch {
      console.log(`[Main] package.json missing. Creating default...`);
      const defaultPkg = {
        name: path.basename(absoluteCwd) || "runner-project",
        version: "1.0.0",
        dependencies: {}
      };
      await fs.writeFile(packageJsonPath, JSON.stringify(defaultPkg, null, 2));
    }

    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const command = `${npmCmd} install ${name} --save`;
    console.log(`[Main] Running: ${command}`);
    
    const { stdout, stderr } = await execPromise(command, { 
      cwd: absoluteCwd, 
      shell: true,
      env: { ...process.env }
    } as unknown as import('child_process').ExecOptions);
    
    const outStr = (stdout || '').toString();
    const errStr = (stderr || '').toString();
    
    console.log(`[Main] NPM success. Output: ${outStr.substring(0, 100)}...`);
    
    const filesAfter = await fs.readdir(absoluteCwd);
    console.log(`[Main] Files after installation: [${filesAfter.join(', ')}]`);
    console.log(`[Main] === END INSTALLATION ===`);
    
    return { success: true, output: outStr + errStr };
  } catch (err: unknown) {
    const error = err as { message: string; stdout?: Buffer | string };
    console.error(`[Main] Installation failed: ${error.message}`);
    const out = error.stdout ? error.stdout.toString() : '';
    return { success: false, output: out, error: error.message };
  }
});

ipcMain.handle('uninstall-package', async (_event, name: string, cwd: string) => {
  console.log(`[Main] Uninstalling package: ${name} in ${cwd}`);
  try {
    const absoluteCwd = path.resolve(cwd);
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const { stdout, stderr } = await execPromise(`${npmCmd} uninstall ${name}`, { 
      cwd: absoluteCwd, 
      shell: true 
    } as unknown as import('child_process').ExecOptions);
    
    const outStr = (stdout || '').toString();
    const errStr = (stderr || '').toString();
    
    return { success: true, output: outStr + errStr };
  } catch (err: unknown) {
    const error = err as { message: string; stdout?: Buffer | string };
    console.error(`[Main] Uninstallation failed: ${error.message}`);
    const out = error.stdout ? error.stdout.toString() : '';
    return { success: false, output: out, error: error.message };
  }
});

ipcMain.handle('search-packages', async (_event, query: string) => {
  if (!query || query.length < 2) return [];
  
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.com/-/v1/search?text=${encodeURIComponent(query)}&size=20`;
    
    const options = {
      headers: {
        'User-Agent': 'runner-js/1.0.0',
        'Accept': 'application/json'
      }
    };

    https.get(url, options, (res: import('http').IncomingMessage) => {
      const { statusCode } = res;
      let data = '';
      
      if (statusCode !== 200) {
        console.error(`NPM search failed with status: ${statusCode}`);
        res.resume(); // Consume response data to free up memory
        resolve([]);
        return;
      }

      res.on('data', (chunk: string | Buffer) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const suggestions = result.objects ? (result.objects as Array<{ package: { name: string, version: string } }>).map((obj) => ({
            name: obj.package.name,
            version: obj.package.version
          })) : [];
          resolve(suggestions);
        } catch (e) {
          console.error('NPM Registry Search - Failed to parse JSON:', e);
          console.error('First 100 chars of response:', data.substring(0, 100));
          resolve([]);
        }
      });
    }).on('error', (err: Error) => {
      console.error('NPM search request failed:', err);
      resolve([]);
    });
  });
});

ipcMain.handle('list-packages', async (_event, cwd: string) => {
  console.log(`[Main] Listing packages in: ${cwd}`);
  try {
    const absoluteCwd = path.resolve(cwd);
    const packageJsonPath = path.join(absoluteCwd, 'package.json');
    
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const list = Object.entries(deps).map(([name, version]) => ({ name, version: version as string }));
      console.log(`[Main] Found ${list.length} installed packages.`);
      return list;
    } catch {
      console.log(`[Main] No package.json found in ${absoluteCwd}`);
      return [];
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.warn(`[Main] list-packages error: ${error.message}`);
    return [];
  }
});

ipcMain.on('stop-execution', () => {
  console.log('[Main] Stop requested');
  SandboxService.stop();
});

// File System IPC Handlers
ipcMain.handle('open-file', async () => {
  if (!win) return { canceled: true };
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'JavaScript Files', extensions: ['js', 'ts', 'jsx', 'tsx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  try {
    const filePath = filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { canceled: false, filePath, content };
  } catch (error) {
    return { canceled: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('save-file', async (_event, content: string, filePath?: string) => {
  if (!win) return { canceled: true };
  let targetPath = filePath;

  if (!targetPath) {
    const { canceled, filePath: dialogPath } = await dialog.showSaveDialog(win, {
      filters: [
        { name: 'JavaScript Files', extensions: ['js'] },
        { name: 'TypeScript Files', extensions: ['ts'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !dialogPath) {
      return { canceled: true };
    }
    targetPath = dialogPath;
  }

  try {
    await fs.writeFile(targetPath, content, 'utf-8');
    return { canceled: false, filePath: targetPath };
  } catch (error) {
    return { canceled: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('select-working-directory', async () => {
  if (!win) return { canceled: true };
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, filePath: filePaths[0] };
});

// Snippets IPC Handlers
ipcMain.handle('get-snippets', async () => {
  return await readSnippets();
});

ipcMain.handle('save-snippet', async (_event, snippet: Snippet) => {
  const snippets = await readSnippets();
  const index = snippets.findIndex((s: Snippet) => s.id === snippet.id);
  
  if (index >= 0) {
    snippets[index] = snippet;
  } else {
    snippets.push(snippet);
  }
  
  const success = await writeSnippets(snippets);
  return { success };
});

ipcMain.handle('delete-snippet', async (_event, id: string) => {
  const snippets = await readSnippets();
  const filtered = snippets.filter((s: Snippet) => s.id !== id);
  const success = await writeSnippets(filtered);
  return { success };
});

ipcMain.handle('get-system-fonts', async () => {
  try {
    if (process.platform === 'win32') {
      // Use PowerShell to get font names on Windows, explicitly loading System.Drawing
      const command = 'powershell -command "Add-Type -AssemblyName System.Drawing; [System.Drawing.Text.InstalledFontCollection]::new().Families.Name"';
      console.log('[Main] Fetching system fonts via PowerShell...');
      const { stdout } = await execPromise(command);
      const fonts = stdout.toString().split(/\r?\n/).map(f => f.trim()).filter(f => f.length > 0);
      console.log(`[Main] Found ${fonts.length} fonts.`);
      return Array.from(new Set(fonts)).sort();
    } else if (process.platform === 'darwin') {
      // Basic approach for macOS
      const { stdout } = await execPromise('system_profiler SPFontsDataType | grep "Full Name" | cut -d ":" -f 2');
      const fonts = stdout.toString().split(/\r?\n/).map(f => f.trim()).filter(f => f.length > 0);
      return Array.from(new Set(fonts)).sort();
    }
    // Fallback
    return ['JetBrains Mono', 'Fira Code', 'Segoe UI', 'Arial', 'Monaco', 'Courier New', 'Consolas'];
  } catch (err) {
    console.error('[Main] Failed to get system fonts:', err);
    return ['JetBrains Mono', 'Fira Code', 'Segoe UI', 'Arial', 'Monaco', 'Courier New', 'Consolas'];
  }
});

// Event Bus Bridging
onConsoleLog((logData: unknown) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('console-output', logData);
  }
});

onConsoleClear(() => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('console-output', { type: 'clear', timestamp: Date.now(), value: [] });
  }
});

onWorkerStatus((status: string) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('worker-status', status);
  }
});

import { onExecutionComplete as onExecutionBusComplete } from '../src/core/event-bus';
onExecutionBusComplete((data: unknown) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('execution-complete', data);
  }
});

// Window controls IPC
ipcMain.on('window-controls', (_event, action) => {
  if (!win || win.isDestroyed()) return;
  switch (action) {
    case 'minimize':
      win.minimize();
      break;
    case 'maximize':
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      break;
    case 'close':
      win.close();
      break;
    case 'bring-to-front':
      win.focus();
      break;
  }
});

// Zoom IPC
ipcMain.handle('set-zoom-factor', (_event, factor: number) => {
  if (win && !win.isDestroyed()) {
    win.webContents.setZoomFactor(factor);
    return true;
  }
  return false;
});

ipcMain.handle('get-zoom-factor', () => {
  if (win && !win.isDestroyed()) {
    return win.webContents.getZoomFactor();
  }
  return 1;
});

import { AIService } from '../src/ai/AIService';
import { AIAPIRequest } from '../src/shared/ipc';

// ... (existing code above) ...

// AI IPC Handler
ipcMain.handle('ask-ai', async (_event, request: AIAPIRequest) => {
  const result = await AIService.handleRequest(request);
  return {
    content: result.message || '',
    error: result.error
  };
});
