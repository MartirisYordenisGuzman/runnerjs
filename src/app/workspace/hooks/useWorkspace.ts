import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AppSettings, ConsoleLogMessage, SessionData, ChatMessage, ElectronAPI } from '../../../shared/ipc';
import type * as monaco from 'monaco-editor';
import { formatCode } from '../formattingService';
import { ThemeRegistry } from '../../../core/themes/ThemeRegistry';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface TabData {
  id: string;
  title: string;
  code: string;
  logs: ConsoleLogMessage[];
  executionTime?: number;
  filePath?: string;
  isDirty?: boolean;
}

export const useWorkspace = () => {
  const [tabs, setTabs] = useState<TabData[]>([
    {
      id: 'tab-1',
      title: 'Untitled',
      code: '// Welcome to RunJS Clone!\nconst msg = "Hello World";\nconsole.log(msg, [1, 2, 3]);\n\nmsg;',
      logs: []
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [isRunning, setIsRunning] = useState(false);
  const [cwd, setCwd] = useState<string | undefined>(undefined);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [systemFonts, setSystemFonts] = useState<string[]>(['JetBrains Mono', 'Fira Code']);
  const [settings, setSettings] = useState<AppSettings>({
    general: { autoRun: true, lineWrap: true, vimKeys: false, autoCloseBrackets: true, scrolling: 'Automatic', confirmClose: false, autocomplete: true, linting: true, hoverInfo: true, signatures: false },
    build: { transform: { typescript: true, jsx: false }, proposals: { optionalChaining: false, regexpModifiers: false, doExpressions: false, functionSent: false, pipelineOperator: false, partialApplication: false, throwExpressions: false, decorators: false } },
    formatting: { autoFormat: false, printWidth: 80, tabWidth: 2, semicolons: true, singleQuotes: false, quoteProps: 'as-needed', jsxQuotes: false, trailingCommas: 'es5', bracketSpacing: true, arrowFunctionParentheses: 'always' },
    appearance: { theme: 'Dark', font: 'JetBrains Mono', fontSize: 14, showLineNumbers: true, showInvisibles: false, highlightActiveLine: true, showTabBar: true, outputHighlighting: true, showActivityBar: true, showConsoleHeader: true },
    ai: { provider: 'openai', openaiModel: 'gpt-4o-mini', openaiApiKey: '', geminiModel: 'gemini-2.0-flash', geminiApiKey: '' },
    advanced: { expressionResults: true, matchLines: true, showUndefined: false, loopProtection: true }
  });
  const [markers, setMarkers] = useState<monaco.editor.IMarkerData[]>([]);
  const zoomFactorRef = useRef(1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const deepMerge = useCallback(<T extends object>(target: T, source: object | null | undefined): T => {
    if (!source || typeof source !== 'object') return target;
    const result = { ...target } as Record<string, unknown>;
    const sourceObj = source as Record<string, unknown>;
    for (const key in sourceObj) {
      const sourceValue = sourceObj[key];
      const targetValue = (target as Record<string, unknown>)[key];
      
      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) && 
          targetValue && typeof targetValue === 'object') {
        result[key] = deepMerge(targetValue as object, sourceValue as object);
      } else {
        result[key] = sourceValue;
      }
    }
    return result as T;
  }, []);

  const parseErrorStack = useCallback((stack: string): monaco.editor.IMarkerData[] => {
    if (!stack) return [];
    const lines = stack.split('\n');
    let locationLine = '';
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].includes('<anonymous>') || lines[i].includes('evalmachine')) {
        locationLine = lines[i];
        break;
      }
    }
    if (!locationLine) return [];
    const match = locationLine.match(/:(\d+):(\d+)/);
    if (!match) return [];
    const line = parseInt(match[1], 10);
    const col = parseInt(match[2], 10);
    return [{
      startLineNumber: line, startColumn: col, endLineNumber: line, endColumn: col + 1,
      message: lines[0] || 'Error', severity: 8
    }];
  }, []);

  // Persistence: Initial Load
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) setSettings(prev => deepMerge(prev, savedSettings));
        
        const savedSession = await window.electronAPI.getSession();
        if (savedSession) {
          if (savedSession.tabs && savedSession.tabs.length > 0) {
            setTabs(savedSession.tabs.map(t => ({ ...t, logs: [] })));
          }
          if (savedSession.activeTabId) setActiveTabId(savedSession.activeTabId);
          if (savedSession.chatHistory) setChatMessages(savedSession.chatHistory);
        }
      } catch (err) { console.error('Failed to load initial data:', err); }
    };
    loadInitialData();
  }, [deepMerge]);

  // Persistence: Save Settings
  useEffect(() => {
    const timer = setTimeout(() => window.electronAPI.saveSettings(settings), 1000);
    return () => clearTimeout(timer);
  }, [settings]);

  // External Info
  useEffect(() => {
    window.electronAPI.getSystemFonts().then(setSystemFonts);
    window.electronAPI.getEnvVars().then(setEnvVars);
    window.electronAPI.getZoomFactor().then(f => { zoomFactorRef.current = f; });
  }, []);

  // Execution Logic
  const handleFormat = useCallback(async (codeToFormat: string, tabId: string) => {
    try {
      const language = settings.build.transform.typescript ? 'typescript' : 'javascript';
      const formatted = await formatCode(codeToFormat, settings.formatting, language);
      if (formatted !== codeToFormat) {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, code: formatted } : t));
      }
      return formatted;
    } catch { return codeToFormat; }
  }, [settings.formatting, settings.build.transform.typescript]);

  const runCode = useCallback(async (codeToRun: string, tabId: string, isManual = false) => {
    setMarkers([]); setIsRunning(true);
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, logs: [] } : t));
    let finalCode = codeToRun;
    if (isManual && settings.formatting.autoFormat) finalCode = await handleFormat(codeToRun, tabId);
    try {
      const result = await window.electronAPI.executeCode(finalCode, { build: settings.build, advanced: settings.advanced }, cwd, envVars);
      setTabs(prev => prev.map(t => {
        if (t.id !== tabId) return t;
        const newLogs = [...t.logs];
        if (result.error) newLogs.push({ type: 'error', value: [result.error], timestamp: Date.now() });
        return { ...t, logs: newLogs, executionTime: result.executionTimeMs };
      }));
    } catch (err) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, logs: [...t.logs, { type: 'error', value: [String(err)], timestamp: Date.now() }] } : t));
    } finally { setIsRunning(false); }
  }, [cwd, envVars, settings.build, settings.advanced, settings.formatting.autoFormat, handleFormat]);

  const stopCode = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    window.electronAPI.stopExecution(); setIsRunning(false);
  }, []);

  // IPC Listeners
  useEffect(() => {
    window.electronAPI.onExecutionComplete((data) => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, executionTime: data.executionTimeMs } : t));
      setIsRunning(false);
      setMarkers(data.success ? [] : parseErrorStack(data.stack || data.error || ''));
    });
    window.electronAPI.onConsoleOutput((log) => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, logs: [...t.logs, log] } : t));
    });
    window.electronAPI.onWorkerStatus(status => setIsRunning(status === 'running'));
    return () => window.electronAPI.removeListeners();
  }, [activeTabId, parseErrorStack]);

  // Tab Operations
  const updateActiveTabCode = useCallback((newCode: string | undefined) => {
    if (newCode === undefined) return;
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, code: newCode, isDirty: true } : t));
  }, [activeTabId]);

  const createNewTab = useCallback(() => {
    const newId = `tab-${Date.now()}`;
    setTabs(prev => [...prev, { id: newId, title: 'Untitled', code: '// New Scratchpad\n', logs: [] }]);
    setActiveTabId(newId);
  }, []);

  const closeTab = useCallback((idToClose: string) => {
    setTabs(prev => {
      if (prev.length === 1) return prev;
      const newTabs = prev.filter(t => t.id !== idToClose);
      if (activeTabId === idToClose) setActiveTabId(newTabs[0].id);
      return newTabs;
    });
  }, [activeTabId]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  return {
    tabs, setTabs,
    activeTabId, setActiveTabId,
    activeTab,
    isRunning, setIsRunning,
    settings, setSettings,
    chatMessages, setChatMessages,
    isChatLoading, setIsChatLoading,
    cwd, setCwd,
    envVars, setEnvVars,
    systemFonts,
    markers, setMarkers,
    runCode, stopCode, handleFormat,
    updateActiveTabCode, createNewTab, closeTab,
    zoomFactorRef,
    debounceRef
  };
};
