import { ipcRenderer, contextBridge } from 'electron';
import type { ConsoleLogMessage, ExecutionCompleteMessage, AppSettings, Snippet, SessionData, ChatMessage } from '../src/shared/ipc';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    executeCode: (code: string, settings: { build: AppSettings['build'], advanced: AppSettings['advanced'] }, cwd?: string, env?: Record<string, string>) => ipcRenderer.invoke('execute-code', code, settings, cwd, env),
    onExecutionComplete: (callback: (result: ExecutionCompleteMessage) => void) => ipcRenderer.on('execution-complete', (_event, value) => callback(value)),
    onConsoleOutput: (callback: (output: ConsoleLogMessage) => void) => ipcRenderer.on('console-output', (_event, value) => callback(value)),
    onWorkerStatus: (callback: (status: 'running' | 'stopped') => void) => ipcRenderer.on('worker-status', (_event, value) => callback(value)),
    // Remove listeners when unmounting
    removeListeners: () => {
      ipcRenderer.removeAllListeners('execution-complete');
      ipcRenderer.removeAllListeners('console-output');
      ipcRenderer.removeAllListeners('worker-status');
    },
    windowControls: (action: 'minimize' | 'maximize' | 'close' | 'bring-to-front') => ipcRenderer.send('window-controls', action),
    openFile: () => ipcRenderer.invoke('open-file'),
    saveFile: (content: string, filePath?: string) => ipcRenderer.invoke('save-file', content, filePath),
    stopExecution: () => ipcRenderer.send('stop-execution'),
    
    // Working Directory
    selectWorkingDirectory: () => ipcRenderer.invoke('select-working-directory'),
    
    // Snippets
    getSnippets: () => ipcRenderer.invoke('get-snippets'),
    saveSnippet: (snippet: Snippet) => ipcRenderer.invoke('save-snippet', snippet),
    deleteSnippet: (id: string) => ipcRenderer.invoke('delete-snippet', id),

    // Env Vars
    getEnvVars: () => ipcRenderer.invoke('get-env-vars'),
    saveEnvVars: (envVars: Record<string, string>) => ipcRenderer.invoke('save-env-vars', envVars),

    // NPM Packages
    installPackage: (name: string, cwd: string) => ipcRenderer.invoke('install-package', name, cwd),
    uninstallPackage: (name: string, cwd: string) => ipcRenderer.invoke('uninstall-package', name, cwd),
    listPackages: (cwd: string) => ipcRenderer.invoke('list-packages', cwd),
    searchPackages: (query: string) => ipcRenderer.invoke('search-packages', query),
    
    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
    
    // Zoom
    setZoomFactor: (factor: number) => ipcRenderer.invoke('set-zoom-factor', factor),
    getZoomFactor: () => ipcRenderer.invoke('get-zoom-factor'),

    // System Fonts
    getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),

    // Session
    getSession: () => ipcRenderer.invoke('get-session'),
    saveSession: (session: SessionData) => ipcRenderer.invoke('save-session', session),

    // AI
    askAI: (messages: ChatMessage[], settings: { model: string; apiKey: string; provider?: 'openai' | 'gemini' }) => ipcRenderer.invoke('ask-ai', messages, settings),
  }
);
