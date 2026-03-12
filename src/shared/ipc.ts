/**
 * Shared types for IPC communication between the Main (node) and Renderer (ui) processes.
 */

// Format of intercepted console outputs from the sandbox
export interface ConsoleLogMessage {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  value: unknown[];
  timestamp: number;
  line?: number;      // Line number for Match Lines alignment
  isCaptured?: boolean; // True if it's an automatically captured expression result
}

// Format of successful/failed execution from the sandbox
export interface ExecutionCompleteMessage {
  success: boolean;
  result?: unknown;
  error?: string;
  stack?: string;
  executionTimeMs: number;
}

export interface Snippet {
  id: string;
  name: string;
  description: string;
  code: string;
  timestamp: number;
}

export interface AppSettings {
  general: {
    autoRun: boolean;
    lineWrap: boolean;
    vimKeys: boolean;
    autoCloseBrackets: boolean;
    scrolling: 'Automatic' | 'None';
    confirmClose: boolean;
    autocomplete: boolean;
    linting: boolean;
    hoverInfo: boolean;
    signatures: boolean;
  },
  build: {
    transform: {
      typescript: boolean;
      jsx: boolean;
    },
    proposals: {
      optionalChaining: boolean;
      regexpModifiers: boolean;
      doExpressions: boolean;
      functionSent: boolean;
      pipelineOperator: boolean;
      partialApplication: boolean;
      throwExpressions: boolean;
      decorators: boolean;
    };
  },
  formatting: {
    autoFormat: boolean;
    printWidth: number;
    tabWidth: number;
    semicolons: boolean;
    singleQuotes: boolean;
    quoteProps: 'as-needed' | 'always' | 'consistent';
    jsxQuotes: boolean;
    trailingCommas: 'none' | 'es5' | 'all';
    bracketSpacing: boolean;
    arrowFunctionParentheses: 'always' | 'avoid';
  },
  appearance: {
    theme: string;
    font: string;
    fontSize: number;
    showLineNumbers: boolean;
    showInvisibles: boolean;
    highlightActiveLine: boolean;
    showTabBar: boolean;
    outputHighlighting: boolean;
    showActivityBar: boolean;
    showConsoleHeader: boolean;
  },
  ai: {
    provider: 'openai' | 'gemini';
    openaiModel: string;
    openaiApiKey: string;
    geminiModel: string;
    geminiApiKey: string;
  },
  advanced: {
    expressionResults: boolean;
    matchLines: boolean;
    showUndefined: boolean;
    loopProtection: boolean;
  }
}

export interface SessionData {
  tabs: Array<{
    id: string;
    title: string;
    code: string;
    filePath?: string;
  }>;
  activeTabId: string | null;
  chatHistory?: ChatMessage[];
  layout: {
    sidebarVisible: boolean;
    outputVisible: boolean;
    layoutDirection: 'horizontal' | 'vertical';
    splitSizes: number[];
    chatSidebarVisible?: boolean;
    chatSplitSizes?: number[];
  };
  windowState?: {
    width: number;
    height: number;
    x: number;
    y: number;
    isMaximized: boolean;
  };
}

export interface ElectronAPI {
  executeCode: (code: string, settings: { build: AppSettings['build'], advanced: AppSettings['advanced'] }, cwd?: string, env?: Record<string, string>) => Promise<ExecutionCompleteMessage>;
  onExecutionComplete: (callback: (result: ExecutionCompleteMessage) => void) => void;
  onConsoleOutput: (callback: (output: ConsoleLogMessage) => void) => void;
  onWorkerStatus: (callback: (status: 'running' | 'stopped') => void) => void;
  removeListeners: () => void;

  windowControls: (action: 'minimize' | 'maximize' | 'close' | 'bring-to-front') => void;
  openFile: () => Promise<{ canceled: boolean; filePath?: string; content?: string; error?: string }>;
  saveFile: (content: string, filePath?: string) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  stopExecution: () => void;
  
  // Working Directory
  selectWorkingDirectory: () => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  
  // Snippets
  getSnippets: () => Promise<Snippet[]>;
  saveSnippet: (snippet: Snippet) => Promise<{ success: boolean; error?: string }>;
  deleteSnippet: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Environment Variables
  getEnvVars: () => Promise<Record<string, string>>;
  saveEnvVars: (envVars: Record<string, string>) => Promise<{ success: boolean; error?: string }>;

  // NPM Packages
  installPackage: (name: string, cwd: string) => Promise<{ success: boolean; output: string; error?: string }>;
  uninstallPackage: (name: string, cwd: string) => Promise<{ success: boolean; output: string; error?: string }>;
  listPackages: (cwd: string) => Promise<{ name: string; version: string }[]>;
  searchPackages: (query: string) => Promise<{ name: string; version: string }[]>;

  // Settings
  getSettings: () => Promise<AppSettings | null>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean; error?: string }>;

  // Zoom
  setZoomFactor: (factor: number) => Promise<boolean>;
  getZoomFactor: () => Promise<number>;

  // Session
  getSession: () => Promise<SessionData | null>;
  saveSession: (session: SessionData) => Promise<{ success: boolean; error?: string }>;

  // System Fonts
  getSystemFonts: () => Promise<string[]>;

  // AI
  askAI: (messages: ChatMessage[], settings: { model: string; apiKey: string; provider?: 'openai' | 'gemini' }) => Promise<{ content: string; error?: string }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
