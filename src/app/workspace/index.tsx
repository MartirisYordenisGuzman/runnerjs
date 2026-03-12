import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Split from 'react-split';
import { Play, Square, Settings, Bookmark, Download, MessageSquare, Menu, Plus, X, Minus, AppWindow, ChevronRight, Check, Columns, Rows } from 'lucide-react';
import { CodeEditor } from '../editor';
import { ConsolePanel } from '../console';
import { SnippetsModal } from './SnippetsModal';
import { EnvVarsModal } from './EnvVarsModal';
import { NpmPackagesModal } from './NpmPackagesModal';
import { EditTitleModal } from './EditTitleModal';
import { SettingsModal } from './SettingsModal';
import { ConfirmModal } from './ConfirmModal';
import type { AppSettings, ConsoleLogMessage, ElectronAPI, SessionData, ChatMessage } from '../../shared/ipc';
import type * as monaco from 'monaco-editor';
import { formatCode } from './formattingService';
import AIChat from './AIChat';
import { ThemeRegistry } from '../../core/themes/ThemeRegistry';
import { registerDefaultThemes } from '../../core/themes/default-themes';
import { registerSnippetSuggestions } from '../../core/snippets/SnippetRegistry';

// Initialize themes once at module level
registerDefaultThemes();

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface TabData {
  id: string;
  title: string;
  code: string;
  logs: ConsoleLogMessage[];
  executionTime?: number;
  filePath?: string;
  isDirty?: boolean;
}

interface TabItemProps {
  tab: TabData;
  isActive: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  fileInitials: string;
}

function TabItem({ tab, isActive, onSelect, onClose, fileInitials }: TabItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent', 
        height: '100%', 
        padding: '0 12px',
        borderRight: '1px solid var(--border-color)',
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: '12px',
        gap: '8px',
        cursor: 'pointer',
        transition: 'all 0.1s ease',
        position: 'relative',
        minWidth: '100px',
        justifyContent: 'center'
      }}>
      <span style={{ 
        color: isActive ? '#66d9ef' : 'var(--text-muted)', 
        fontWeight: 600, 
        fontSize: '10px',
        opacity: isActive ? 1 : 0.6,
        letterSpacing: '0.02em',
        width: '24px',
        textAlign: 'center',
        paddingTop: '2px'
      }}>
        {fileInitials}
      </span>
      <span style={{ 
        maxWidth: '120px', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap',
        fontWeight: isActive ? 500 : 400
      }}>
        {tab.title}
      </span>
      
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onClose(e);
        }}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          marginLeft: '4px'
        }}
      >
        {(tab.isDirty && !isHovered) ? (
          <div style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            backgroundColor: isActive ? 'var(--accent-color)' : 'var(--text-muted)',
            opacity: 0.8
          }} />
        ) : (
          <X 
            size={12} 
            style={{ 
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.1s ease',
              color: 'var(--text-muted)'
            }} 
          />
        )}
      </div>
    </div>
  );
}

const getThemePalette = (themeName: string): string[] => {
    const theme = ThemeRegistry.getTheme(themeName);
    if (!theme) return ['#333', '#444', '#555', '#666'];
    const colors: string[] = [];
    colors.push(theme.colors['editor.background'] || '#1e1e1e');
    
    const findColor = (scopes: string[]) => {
        const tc = (theme.tokenColors || []).find(t => {
            if (!t.scope) return false;
            const s = Array.isArray(t.scope) ? t.scope : [t.scope];
            return s.some(scope => scopes.some(target => scope.includes(target)));
        });
        return tc?.settings.foreground;
    };

    colors.push(findColor(['keyword', 'storage']) || '#c678dd');
    colors.push(findColor(['string']) || '#98c379');
    colors.push(findColor(['function', 'method']) || '#61afef');
    
    return colors;
};

interface MenuItemProps {
  name?: string;
  color?: string;
  shortcut?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  hasSubmenu?: boolean;
  isChecked?: boolean;
  isDot?: boolean;
  isSeparator?: boolean;
  palette?: string[];
  icon?: React.ReactNode;
  isActive?: boolean;
}

const MenuItem = ({ name, color, shortcut, onClick, onMouseEnter, hasSubmenu, isChecked, isDot, isSeparator, palette, icon, isActive }: MenuItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  
  if (isSeparator) {
    return <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0', opacity: 0.5 }} />;
  }

  return (
    <div 
      style={{ 
        padding: '4px 12px', 
        cursor: 'pointer', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: (isHovered || isActive) ? 'var(--bg-item-hover)' : 'transparent',
        transition: 'background-color 0.1s ease',
        borderRadius: '4px',
        margin: '0 4px',
        minHeight: '26px'
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (onMouseEnter) onMouseEnter();
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {isChecked && !isDot && <Check size={14} color="var(--accent-color)" strokeWidth={3} />}
          {isDot && (
            <div style={{ 
              width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {isChecked && <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--accent-color)' }} />}
            </div>
          )}
          {!isChecked && !isDot && icon && <div style={{ opacity: 0.8 }}>{icon}</div>}
        </div>
        {palette && (
            <div style={{ display: 'flex', height: '10px', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', marginRight: '4px' }}>
                {palette.map((c, i) => <div key={i} style={{ width: '10px', backgroundColor: c }} />)}
            </div>
        )}
        <span style={{ 
          color: color || 'var(--text-primary)', 
          fontWeight: isHovered ? 500 : 400,
          fontSize: '12px',
          opacity: isHovered ? 1 : 0.85,
          whiteSpace: 'nowrap'
        }}>
          {name}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '16px', whiteSpace: 'nowrap', paddingRight: '4px' }}>
        {shortcut && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>{shortcut}</span>}
        {hasSubmenu && <ChevronRight size={13} color="var(--text-muted)" />}
      </div>
    </div>
  );
};

interface SubmenuProps {
  top: string | number;
  left: string | number;
  width?: string | number;
  children: React.ReactNode;
  onMouseEnter?: () => void;
}

const SubmenuContainer = ({ top, left, children, onMouseEnter }: SubmenuProps) => (
  <div 
    style={{
      position: 'fixed', top, left, width: 'fit-content', minWidth: '180px',
      backgroundColor: 'var(--bg-menu)', 
      borderRadius: '8px', 
      boxShadow: '0 10px 40px rgba(0,0,0,0.6), 0 0 0 1px var(--border-color)',
      zIndex: 100, padding: '4px 0',
      display: 'flex', flexDirection: 'column', color: 'var(--text-primary)',
      animation: 'fadeIn 0.1s ease-out'
    }}
    onMouseEnter={onMouseEnter}
  >
    {children}
  </div>
);

const getFileTypeInitials = (filePath: string | undefined, isTypescriptSetting: boolean): string => {
  if (filePath) {
    const parts = filePath.split('.');
    if (parts.length > 1) {
      const ext = parts.pop()?.toLowerCase();
      if (ext === 'js') return 'JS';
      if (ext === 'ts') return 'TS';
      if (ext === 'jsx') return 'JSX';
      if (ext === 'tsx') return 'TSX';
    }
  }
  return isTypescriptSetting ? 'TS' : 'JS';
};

export function Workspace() {
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  
  const zoomFactorRef = useRef(1);
  const [cwd, setCwd] = useState<string | undefined>(undefined);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  const [isEnvVarsModalOpen, setIsEnvVarsModalOpen] = useState(false);
  const [isNpmModalOpen, setIsNpmModalOpen] = useState(false);
  const [isSnippetsModalOpen, setIsSnippetsModalOpen] = useState(false);
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSplitSizes, setChatSplitSizes] = useState([20, 80]);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [systemFonts, setSystemFonts] = useState<string[]>(['JetBrains Mono', 'Fira Code']);
  const [isOutputVisible, setIsOutputVisible] = useState(true);
  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [splitSizes, setSplitSizes] = useState<number[]>([50, 50]);
  const [activeSidePane, setActiveSidePane] = useState<'chat' | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{ 
    isOpen: boolean, 
    idToClose: string | null 
  }>({ isOpen: false, idToClose: null });
  const [settings, setSettings] = useState<AppSettings>({
    general: { autoRun: true, lineWrap: true, vimKeys: false, autoCloseBrackets: true, scrolling: 'Automatic', confirmClose: false, autocomplete: true, linting: true, hoverInfo: true, signatures: false },
    build: { transform: { typescript: true, jsx: false }, proposals: { optionalChaining: false, regexpModifiers: false, doExpressions: false, functionSent: false, pipelineOperator: false, partialApplication: false, throwExpressions: false, decorators: false } },
    formatting: { autoFormat: false, printWidth: 80, tabWidth: 2, semicolons: true, singleQuotes: false, quoteProps: 'as-needed', jsxQuotes: false, trailingCommas: 'es5', bracketSpacing: true, arrowFunctionParentheses: 'always' },
    appearance: { theme: 'Dark', font: 'JetBrains Mono', fontSize: 14, showLineNumbers: true, showInvisibles: false, highlightActiveLine: true, showTabBar: true, outputHighlighting: true, showActivityBar: true, showConsoleHeader: true },
    ai: { provider: 'openai', openaiModel: 'gpt-4o-mini', openaiApiKey: '', geminiModel: 'gemini-2.0-flash', geminiApiKey: '' },
    advanced: { expressionResults: true, matchLines: true, showUndefined: false, loopProtection: true }
  });

  const editorLineHeight = useMemo(() => Math.max(8, Math.round(settings.appearance.fontSize * 1.35)), [settings.appearance.fontSize]);
  const [markers, setMarkers] = useState<monaco.editor.IMarkerData[]>([]);

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

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) {
          setSettings(prev => deepMerge(prev, savedSettings));
        }
        const savedSession = await window.electronAPI.getSession();
        if (savedSession) {
          if (savedSession.tabs && savedSession.tabs.length > 0) setTabs(savedSession.tabs.map(t => ({ ...t, logs: [] })));
          if (savedSession.activeTabId) setActiveTabId(savedSession.activeTabId);
          if (savedSession.chatHistory) setChatMessages(savedSession.chatHistory);
          if (savedSession.layout) {
            setIsSidebarVisible(savedSession.layout.sidebarVisible);
            setIsOutputVisible(savedSession.layout.outputVisible);
            setLayoutDirection(savedSession.layout.layoutDirection);
            if (savedSession.layout.splitSizes) setSplitSizes(savedSession.layout.splitSizes);
            if (savedSession.layout.chatSidebarVisible) setActiveSidePane('chat');
            if (savedSession.layout.chatSplitSizes) setChatSplitSizes(savedSession.layout.chatSplitSizes);
          }
        }
      } catch (err) { console.error('Failed to load initial data:', err); }
    };
    loadInitialData();
  }, [deepMerge]);

  useEffect(() => {
    const timer = setTimeout(() => window.electronAPI.saveSettings(settings), 1000);
    // Sync sidebar visibility state with settings if changed via modal
    setIsSidebarVisible(settings.appearance.showActivityBar);
    return () => clearTimeout(timer);
  }, [settings.appearance.showActivityBar, settings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const sessionData: SessionData = {
        tabs: tabs.map(t => ({ id: t.id, title: t.title, code: t.code, filePath: t.filePath })),
        activeTabId, chatHistory: chatMessages,
        layout: { sidebarVisible: isSidebarVisible, outputVisible: isOutputVisible, layoutDirection, splitSizes, chatSidebarVisible: activeSidePane === 'chat', chatSplitSizes }
      };
      window.electronAPI.saveSession(sessionData);
    }, 2000);
    return () => clearTimeout(timer);
  }, [tabs, activeTabId, chatMessages, isSidebarVisible, isOutputVisible, layoutDirection, splitSizes, activeSidePane, chatSplitSizes]);

  useEffect(() => {
    window.electronAPI.getSystemFonts().then(setSystemFonts);
    window.electronAPI.getEnvVars().then(setEnvVars);
    window.electronAPI.getZoomFactor().then(f => { zoomFactorRef.current = f; });
  }, []);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => {
    editorRef.current = editor;
    editor.focus();
    window.electronAPI.getSnippets().then(data => registerSnippetSuggestions(m, data));
  };

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

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

  useEffect(() => ThemeRegistry.applyTheme(settings.appearance.theme), [settings.appearance.theme]);

  const changeFontSize = useCallback((delta: number) => {
    setSettings(prev => ({
      ...prev,
      appearance: { ...prev.appearance, fontSize: Math.max(8, Math.min(48, prev.appearance.fontSize + delta)) }
    }));
  }, []);

  const handleZoom = useCallback(async (delta: number | 'reset') => {
    const newZoom = delta === 'reset' ? 1.0 : Math.max(0.4, Math.min(3.0, zoomFactorRef.current + delta));
    if (newZoom === zoomFactorRef.current && delta !== 'reset') return;
    zoomFactorRef.current = newZoom;
    await window.electronAPI.setZoomFactor(newZoom);
  }, []);

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
        // Removed automatic final expression result summary (=>) to respect user settings
        return { ...t, logs: newLogs, executionTime: result.executionTimeMs };
      }));
    } catch (err) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, logs: [...t.logs, { type: 'error', value: [String(err)], timestamp: Date.now() }] } : t));
    } finally { setIsRunning(false); }
  }, [cwd, envVars, settings.build, settings.advanced, settings.formatting.autoFormat, handleFormat]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!settings.general.autoRun) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runCode(activeTab.code, activeTabId, false), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [activeTab.code, activeTabId, runCode, settings.general.autoRun]);

  const stopCode = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    window.electronAPI.stopExecution(); setIsRunning(false);
  }, []);

  const createNewTab = useCallback(() => {
    const newId = `tab-${Date.now()}`;
    setTabs(prev => [...prev, { id: newId, title: 'Untitled', code: '// New Scratchpad\n', logs: [] }]);
    setActiveTabId(newId);
  }, []);

  const handleConfirmCloseTab = useCallback((idToClose: string) => {
    setTabs(prev => {
        const remaining = prev.filter(t => t.id !== idToClose);
        if (remaining.length === 0) return prev;
        if (activeTabId === idToClose) setActiveTabId(remaining[remaining.length - 1].id);
        return remaining;
    });
  }, [activeTabId]);

  const updateActiveTabCode = useCallback((code: string | undefined) => {
    if (code === undefined) return;
    setTabs(prev => {
        const tab = prev.find(t => t.id === activeTabId);
        if (tab && tab.code === code) return prev;
        return prev.map(t => t.id === activeTabId ? { ...t, code, isDirty: true } : t);
    });
  }, [activeTabId]);

  const handleSendToAI = useCallback(async (messages: ChatMessage[]): Promise<{ success?: boolean; error?: string }> => {
    if (isChatLoading) return { error: 'Chat is busy' };
    setIsChatLoading(true);
    if (activeSidePane !== 'chat') setActiveSidePane('chat');
    try {
      const response = await window.electronAPI.askAI(messages, {
        provider: settings.ai.provider,
        apiKey: settings.ai.provider === 'openai' ? settings.ai.openaiApiKey : settings.ai.geminiApiKey,
        model: settings.ai.provider === 'openai' ? settings.ai.openaiModel : settings.ai.geminiModel
      });
      if (response.error) return { error: response.error };
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
      return { success: true };
    } catch (err) { return { error: String(err) }; }
    finally { setIsChatLoading(false); }
  }, [isChatLoading, activeSidePane, settings.ai]);

  const handleExplainOutput = useCallback(() => {
    const logsText = activeTab.logs.map(log => `[${log.type}] ${log.value.join(' ')}`).join('\n');
    if (!logsText.trim()) return;
    const explainMessage: ChatMessage = { role: 'user', content: `Explain this output:\n\`\`\`\n${logsText}\n\`\`\`` };
    setChatMessages(prev => [...prev, explainMessage]);
    handleSendToAI([{ role: 'system', content: `Expert dev. Context:\n\`\`\`javascript\n${activeTab.code}\n\`\`\`` }, ...chatMessages, explainMessage]);
  }, [activeTab, chatMessages, handleSendToAI]);

  const handleOpenFile = useCallback(async () => {
    const result = await window.electronAPI.openFile();
    if (!result.canceled && result.filePath) {
      const fileName = result.filePath.split(/[\\/]/).pop() || 'Untitled';
      if (activeTab.title === 'Untitled' && activeTab.code.trim() === '// Welcome to RunJS Clone!') {
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: fileName, code: result.content!, filePath: result.filePath, isDirty: false } : t));
      } else {
        const newId = `tab-${Date.now()}`;
        setTabs(prev => [...prev, { id: newId, title: fileName, code: result.content!, logs: [], filePath: result.filePath, isDirty: false }]);
        setActiveTabId(newId);
      }
    }
  }, [activeTab, activeTabId]);

  const handleSaveFile = useCallback(async (saveAs = false) => {
    const result = await window.electronAPI.saveFile(activeTab.code, saveAs ? undefined : activeTab.filePath);
    if (!result.canceled && result.filePath) {
      const fileName = result.filePath.split(/[\\/]/).pop() || 'Untitled';
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: fileName, filePath: result.filePath, isDirty: false } : t));
    }
  }, [activeTab, activeTabId]);

  const executeEditorCommand = useCallback((command: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    if (command === 'clear') updateActiveTabCode('');
    else if (command === 'editor.action.clipboardCopyAction' || command === 'editor.action.clipboardCutAction') {
      const selection = editor.getSelection();
      const text = editor.getModel()?.getValueInRange(selection!);
      if (text) {
        navigator.clipboard.writeText(text);
        if (command === 'editor.action.clipboardCutAction') editor.executeEdits('cut', [{ range: selection!, text: '' }]);
      }
    } else if (command === 'editor.action.clipboardPasteAction') {
      navigator.clipboard.readText().then(text => editor.executeEdits('paste', [{ range: editor.getSelection()!, text }]));
    } else editor.trigger('keyboard', command, null);
    editor.focus(); setIsMenuOpen(false); setActiveSubmenu(null);
  }, [updateActiveTabCode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;
      const key = e.key.toLowerCase();
      
      if (isCtrl) {
        if (isShift) {
            if (e.key === '+' || e.code === 'Equal' || e.key === '=') { e.preventDefault(); changeFontSize(1); }
            else if (e.code === 'Minus' || e.key === '-') { e.preventDefault(); changeFontSize(-1); }
        } else {
            if (e.code === 'Equal' || e.key === '=') { e.preventDefault(); handleZoom(0.1); }
            else if (e.code === 'Minus' || e.key === '-') { e.preventDefault(); handleZoom(-0.1); }
            else if (e.code === 'Digit0' || e.key === '0') { e.preventDefault(); handleZoom('reset'); setSettings(prev => ({ ...prev, appearance: { ...prev.appearance, fontSize: 14 } })); }
        }
        
        if (key === 't') { e.preventDefault(); createNewTab(); }
        else if (key === 'o') { e.preventDefault(); handleOpenFile(); }
        else if (key === 's') { e.preventDefault(); handleSaveFile(isShift); }
        else if (key === 'r') { 
          e.preventDefault(); 
          if (isShift) stopCode(); 
          else runCode(activeTab.code, activeTabId, true); 
        }
        else if (key === 'k') { 
            e.preventDefault(); 
            if (isShift) updateActiveTabCode(''); // Ctrl+Shift+K in RunJS
            else stopCode(); 
        }
        else if (key === ',' || key === 'comma' || e.code === 'Comma') { e.preventDefault(); setIsSettingsModalOpen(true); }
        else if (key === '\\' || e.code === 'Backslash') { e.preventDefault(); setIsSidebarVisible(v => !v); }
        else if (key === 'j') { e.preventDefault(); setIsOutputVisible(v => !v); }
        else if (key === 'b') { e.preventDefault(); setIsSnippetsModalOpen(true); }
        else if (key === 'i') { e.preventDefault(); setIsNpmModalOpen(true); }
        else if (key === 'w') { e.preventDefault(); handleConfirmCloseTab(activeTabId); }
      } else if (isAlt && isShift && key === 'f') {
          e.preventDefault();
          handleFormat(activeTab.code, activeTabId);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeTab.code, activeTabId, runCode, handleOpenFile, handleSaveFile, createNewTab, changeFontSize, handleZoom, stopCode, handleConfirmCloseTab, handleFormat, updateActiveTabCode]);


  const handleUpdateTabTitle = useCallback((newTitle: string) => {
    setTabs(prev => prev.map(tab => tab.id === activeTabId ? { ...tab, title: newTitle } : tab));
  }, [activeTabId]);

  const handleInsertSnippet = useCallback((code: string, newTab: boolean) => {
    if (newTab) {
      const newId = `tab-${Date.now()}`;
      setTabs(prev => [...prev, { id: newId, title: 'New Snippet', code, logs: [] }]);
      setActiveTabId(newId);
    } else {
      if (editorRef.current) {
        const editor = editorRef.current;
        const selection = editor.getSelection();
        if (selection) {
          editor.executeEdits('snippet', [{ range: selection, text: code, forceMoveMarkers: true }]);
          editor.focus();
        }
      } else updateActiveTabCode(code);
    }
  }, [updateActiveTabCode]);

  const handleSetWorkingDirectory = useCallback(async () => {
    const result = await window.electronAPI.selectWorkingDirectory();
    if (!result.canceled && result.filePath) {
      setCwd(result.filePath);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, logs: [] } : t));
  }, [activeTabId]);

  const renderContent = () => {
    const editorPanel = (
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', height: '100%', overflow: 'hidden', flex: activeSidePane === 'chat' ? undefined : 1 }}>
        {isOutputVisible ? (
          <Split 
            key={layoutDirection}
            sizes={splitSizes} 
            minSize={100} 
            gutterSize={6} 
            direction={layoutDirection} 
            onDragEnd={setSplitSizes} 
            style={{ 
              display: 'flex', 
              flexDirection: layoutDirection === 'horizontal' ? 'row' : 'column', 
              flex: 1, 
              height: '100%', 
              overflow: 'hidden' 
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', width: '100%' }}>
              <CodeEditor 
                key={`${activeTabId}-${settings.appearance.theme}-${settings.appearance.fontSize}`} 
                code={activeTab.code} 
                onChange={updateActiveTabCode} 
                onMount={handleEditorDidMount} 
                theme={settings.appearance.theme} 
                fontSize={settings.appearance.fontSize} 
                wordWrap={settings.general.lineWrap ? 'on' : 'off'} 
                lineNumbers={settings.appearance.showLineNumbers ? 'on' : 'off'} 
                fontFamily={settings.appearance.font} 
                markers={markers} 
                language={settings.build.transform.typescript ? 'typescript' : 'javascript'} 
                jsxEnabled={settings.build.transform.jsx} 
                renderWhitespace={settings.appearance.showInvisibles ? 'all' : 'none'}
                highlightActiveLine={settings.appearance.highlightActiveLine}
                vimKeys={settings.general.vimKeys}
                autoCloseBrackets={settings.general.autoCloseBrackets}
                autocomplete={settings.general.autocomplete}
                linting={settings.general.linting}
                hoverInfo={settings.general.hoverInfo}
                signatures={settings.general.signatures}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', width: '100%' }}>
              <ConsolePanel 
                logs={activeTab.logs} 
                executionTime={activeTab.executionTime} 
                scrolling={settings.general.scrolling} 
                highlighting={settings.appearance.outputHighlighting}
                matchLines={settings.advanced.matchLines}
                lineHeight={editorLineHeight} 
                fontSize={settings.appearance.fontSize} 
                showConsoleHeader={settings.appearance.showConsoleHeader}
                onExplain={handleExplainOutput} 
              />
            </div>
          </Split>
        ) : (
          <CodeEditor 
            key={`${activeTabId}-${settings.appearance.theme}-${settings.appearance.fontSize}`} 
            code={activeTab.code} 
            onChange={updateActiveTabCode} 
            onMount={handleEditorDidMount} 
            theme={settings.appearance.theme} 
            fontSize={settings.appearance.fontSize} 
            wordWrap={settings.general.lineWrap ? 'on' : 'off'} 
            language={settings.build.transform.typescript ? 'typescript' : 'javascript'} 
            renderWhitespace={settings.appearance.showInvisibles ? 'all' : 'none'}
            highlightActiveLine={settings.appearance.highlightActiveLine}
            vimKeys={settings.general.vimKeys}
            autoCloseBrackets={settings.general.autoCloseBrackets}
            autocomplete={settings.general.autocomplete}
            linting={settings.general.linting}
            hoverInfo={settings.general.hoverInfo}
            signatures={settings.general.signatures}
          />
        )}
      </div>
    );

    if (activeSidePane === 'chat') {
      return (
        <Split sizes={chatSplitSizes} minSize={[250, 400]} gutterSize={6} direction="horizontal" onDragEnd={setChatSplitSizes} style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <AIChat messages={chatMessages} setMessages={setChatMessages} isLoading={isChatLoading} provider={settings.ai.provider} apiKey={settings.ai.provider === 'openai' ? settings.ai.openaiApiKey : settings.ai.geminiApiKey} currentCode={activeTab.code} onOpenSettings={() => setIsSettingsModalOpen(true)} onSendMessage={handleSendToAI} />
          </div>
          {editorPanel}
        </Split>
      );
    }

    return editorPanel;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      <div style={{ height: '44px', backgroundColor: 'var(--bg-toolbar)', display: 'flex', alignItems: 'center', padding: '0 16px 0 4px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ cursor: 'pointer', padding: '8px', backgroundColor: isMenuOpen ? 'var(--bg-item-hover)' : 'transparent', borderRadius: '6px', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
          <Menu size={20} color={isMenuOpen ? 'var(--text-primary)' : 'var(--text-muted)'} />
        </div>
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', marginRight: '8px' }} />
        {(settings.appearance.showTabBar || tabs.length > 1) && tabs.map(tab => (
          <TabItem key={tab.id} tab={tab} isActive={activeTabId === tab.id} onSelect={() => setActiveTabId(tab.id)} onClose={(e) => { e.stopPropagation(); handleConfirmCloseTab(tab.id); }} fileInitials={getFileTypeInitials(tab.filePath, settings.build.transform.typescript)} />
        ))}
        {(settings.appearance.showTabBar || tabs.length > 1) && (
          <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', height: '100%' }}>
            <Plus size={18} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={createNewTab} />
          </div>
        )}
        <div style={{ flex: 1, height: '100%', WebkitAppRegion: 'drag' } as React.CSSProperties} />
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Minus size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => window.electronAPI.windowControls('minimize')} />
          <AppWindow size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => window.electronAPI.windowControls('maximize')} />
          <X size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => window.electronAPI.windowControls('close')} />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {isSidebarVisible && (
          <div style={{ width: '56px', backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => runCode(activeTab.code, activeTabId, true)} title="Run (Ctrl+R)">
                <Play size={20} color="var(--text-muted)" />
              </div>
              <div style={{ cursor: isRunning ? 'pointer' : 'default', opacity: isRunning ? 1 : 0.4 }} onClick={isRunning ? stopCode : undefined} title="Stop (Ctrl+Shift+R)">
                <Square size={18} color="var(--text-muted)" />
              </div>
              <div style={{ width: '24px', height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '4px 0' }} />
              <div style={{ cursor: 'pointer' }} onClick={() => setIsSnippetsModalOpen(true)} title="Snippets (Ctrl+B)">
                <Bookmark size={20} color="var(--text-muted)" />
              </div>
              <div style={{ cursor: 'pointer' }} onClick={() => setIsNpmModalOpen(true)} title="NPM Packages (Ctrl+I)">
                <Download size={20} color="var(--text-muted)" />
              </div>
              <div style={{ cursor: 'pointer' }} onClick={() => setActiveSidePane(activeSidePane === 'chat' ? null : 'chat')} title="AI Chat">
                <MessageSquare size={20} color={activeSidePane === 'chat' ? 'var(--accent-color)' : 'var(--text-muted)'} />
              </div>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => setIsSettingsModalOpen(true)} title="Settings (Ctrl+,)">
                <Settings size={20} color="var(--text-muted)" />
              </div>
            </div>
          </div>
        )}
        
        {renderContent()}
      </div>

      {isMenuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsMenuOpen(false)} />
          <div style={{ position: 'fixed', top: '40px', left: '56px', width: 'fit-content', minWidth: '140px', backgroundColor: 'var(--bg-menu)', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', zIndex: 50, padding: '8px 4px' }}>
            {['File', 'Edit', 'Action', 'Tools', 'View', 'Themes', 'Window', 'Help'].map(item => (
              <MenuItem 
                key={item} 
                name={item} 
                hasSubmenu 
                onMouseEnter={() => setActiveSubmenu(item)} 
                color={(item === 'Action') ? '#eab308' : undefined} 
                isActive={activeSubmenu?.startsWith(item)}
              />
            ))}
          </div>
          {activeSubmenu?.startsWith('File') && (
            <SubmenuContainer top="40px" left="200px" onMouseEnter={() => setActiveSubmenu('File')}>
              <MenuItem name="New Tab" shortcut="Ctrl+T" onClick={createNewTab} />
              <MenuItem name="Re-open Closed Tab" shortcut="Ctrl+Shift+T" />
              <MenuItem name="Open..." shortcut="Ctrl+O" onClick={handleOpenFile} />
              <MenuItem isSeparator />
              <MenuItem name="Save" shortcut="Ctrl+S" onClick={() => handleSaveFile(false)} />
              <MenuItem name="Save As..." shortcut="Ctrl+Shift+S" onClick={() => handleSaveFile(true)} />
              <MenuItem isSeparator />
              <MenuItem name="Settings..." shortcut="Ctrl+," onClick={() => setIsSettingsModalOpen(true)} />
              <MenuItem isSeparator />
              <MenuItem isSeparator />
              <MenuItem name="Close Tab" shortcut="Ctrl+W" onClick={() => handleConfirmCloseTab(activeTabId)} />
              <MenuItem name="Exit" onClick={() => window.electronAPI.windowControls('close')} />
            </SubmenuContainer>
          )}
          {activeSubmenu?.startsWith('Edit') && (
            <SubmenuContainer top="80px" left="200px" onMouseEnter={() => setActiveSubmenu('Edit')}>
              <MenuItem name="Undo" shortcut="Ctrl+Z" onClick={() => executeEditorCommand('undo')} />
              <MenuItem name="Redo" shortcut="Ctrl+Shift+Z" onClick={() => executeEditorCommand('redo')} />
              <MenuItem isSeparator />
              <MenuItem name="Cut" onClick={() => executeEditorCommand('editor.action.clipboardCutAction')} />
              <MenuItem name="Copy" onClick={() => executeEditorCommand('editor.action.clipboardCopyAction')} />
              <MenuItem name="Paste" onClick={() => executeEditorCommand('editor.action.clipboardPasteAction')} />
              <MenuItem name="Select All" shortcut="Ctrl+A" onClick={() => executeEditorCommand('editor.action.selectAll')} />
              <MenuItem name="Clear" shortcut="Ctrl+Shift+K" onClick={() => updateActiveTabCode('')} />
              <MenuItem isSeparator />
              <MenuItem name="Find" shortcut="Ctrl+F" onClick={() => executeEditorCommand('actions.find')} />
              <MenuItem name="Replace" shortcut="Alt+Ctrl+F" onClick={() => executeEditorCommand('editor.action.startFindReplaceAction')} />
              <MenuItem isSeparator />
              <MenuItem name="Toggle Line Comment" shortcut="Ctrl+/" onClick={() => executeEditorCommand('editor.action.commentLine')} />
              <MenuItem name="Toggle Block Comment" shortcut="Alt+Ctrl+/" onClick={() => executeEditorCommand('editor.action.blockComment')} />
            </SubmenuContainer>
          )}
          {activeSubmenu?.startsWith('Action') && (
            <SubmenuContainer top="120px" left="200px" onMouseEnter={() => setActiveSubmenu('Action')}>
              <MenuItem name="Run" shortcut="Ctrl+R" icon={<Play size={13} fill="currentColor" />} onClick={() => runCode(activeTab.code, activeTabId, true)} />
              <MenuItem name="Stop" shortcut="Ctrl+Shift+R" icon={<Square size={11} fill="currentColor" />} onClick={stopCode} />
              <MenuItem name="Kill" shortcut="Ctrl+K" onClick={stopCode} />
              <MenuItem isSeparator />
              <MenuItem name="Set Working Directory..." onClick={handleSetWorkingDirectory} />
              <MenuItem name="Format Code" shortcut="Alt+Shift+F" onClick={() => handleFormat(activeTab.code, activeTabId)} />
              <MenuItem name="Create Snippet..." onClick={() => setIsSnippetsModalOpen(true)} />
            </SubmenuContainer>
          )}
          {activeSubmenu?.startsWith('Tools') && (
            <SubmenuContainer top="160px" left="200px" onMouseEnter={() => setActiveSubmenu('Tools')}>
              <MenuItem name="Snippets" shortcut="Ctrl+B" onClick={() => setIsSnippetsModalOpen(true)} />
              <MenuItem name="Environment Variables" onClick={() => setIsEnvVarsModalOpen(true)} />
              <MenuItem name="NPM Packages" shortcut="Ctrl+I" onClick={() => setIsNpmModalOpen(true)} />
              <MenuItem name="Settings" shortcut="Ctrl+," onClick={() => setIsSettingsModalOpen(true)} />
            </SubmenuContainer>
          )}
          {activeSubmenu?.startsWith('View') && (
            <SubmenuContainer top="200px" left="200px" onMouseEnter={() => setActiveSubmenu('View')}>
              <MenuItem name="Actual Size" shortcut="Ctrl+0" onClick={() => { handleZoom('reset'); setSettings(prev => ({ ...prev, appearance: { ...prev.appearance, fontSize: 14 } })); }} />
              <MenuItem name="Increase Font Size" shortcut="Ctrl++" onClick={() => changeFontSize(1)} />
              <MenuItem name="Decrease Font Size" shortcut="Ctrl+-" onClick={() => changeFontSize(-1)} />
              <MenuItem name="Full Screen" onClick={() => window.electronAPI.windowControls('maximize')} />
              <MenuItem isSeparator />
              <MenuItem name="Activity Bar" isChecked={isSidebarVisible} onClick={() => setIsSidebarVisible(v => !v)} />
              <MenuItem name="Output" isChecked={isOutputVisible} onClick={() => setIsOutputVisible(v => !v)} />
              <MenuItem name="Clear Console" onClick={clearLogs} />
              <MenuItem name="Layout" hasSubmenu onMouseEnter={() => setActiveSubmenu('View-Layout')} />
            </SubmenuContainer>
          )}
          {activeSubmenu === 'View-Layout' && (
            <SubmenuContainer top="396px" left="350px" onMouseEnter={() => setActiveSubmenu('View-Layout')}>
                <MenuItem name="Horizontal" isChecked={layoutDirection === 'horizontal'} isDot icon={<Columns size={12} />} onClick={() => setLayoutDirection('horizontal')} />
                <MenuItem name="Vertical" isChecked={layoutDirection === 'vertical'} isDot icon={<Rows size={12} />} onClick={() => setLayoutDirection('vertical')} />
            </SubmenuContainer>
          )}
          {activeSubmenu === 'Themes' && (
            <SubmenuContainer top="240px" left="200px" onMouseEnter={() => setActiveSubmenu('Themes')}>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {ThemeRegistry.getAllThemes().map(t => (
                        <MenuItem 
                            key={t} 
                            name={t} 
                            isChecked={settings.appearance.theme === t}
                            palette={getThemePalette(t)}
                            onClick={() => {
                                setSettings(prev => ({ ...prev, appearance: { ...prev.appearance, theme: t } }));
                                setIsMenuOpen(false);
                                setActiveSubmenu(null);
                            }} 
                        />
                    ))}
                </div>
            </SubmenuContainer>
          )}
          {activeSubmenu === 'Window' && (
            <SubmenuContainer top="280px" left="200px" onMouseEnter={() => setActiveSubmenu('Window')}>
              <MenuItem name="Minimize" shortcut="Ctrl+M" onClick={() => window.electronAPI.windowControls('minimize')} />
              <MenuItem name="Maximize" shortcut="Ctrl+Shift+M" onClick={() => window.electronAPI.windowControls('maximize')} />
              <MenuItem name="Close" shortcut="Ctrl+W" onClick={() => window.electronAPI.windowControls('close')} />
            </SubmenuContainer>
          )}
          {activeSubmenu === 'Help' && (
            <SubmenuContainer top="320px" left="200px" onMouseEnter={() => setActiveSubmenu('Help')}>
              <MenuItem name="Welcome" />
              <MenuItem name="Documentation" />
              <MenuItem isSeparator />
              <MenuItem name="Check for Updates..." />
              <MenuItem isSeparator />
              <MenuItem name="About RunJS" />
            </SubmenuContainer>
          )}
        </>
      )}

      <SnippetsModal isOpen={isSnippetsModalOpen} onClose={() => setIsSnippetsModalOpen(false)} onInsert={handleInsertSnippet} theme={settings.appearance.theme} />
      <EnvVarsModal isOpen={isEnvVarsModalOpen} onClose={() => setIsEnvVarsModalOpen(false)} envVars={envVars} onUpdate={setEnvVars} />
      <NpmPackagesModal isOpen={isNpmModalOpen} onClose={() => setIsNpmModalOpen(false)} cwd={cwd} onChangeDirectory={handleSetWorkingDirectory} />
      <EditTitleModal isOpen={isEditTitleModalOpen} onClose={() => setIsEditTitleModalOpen(false)} currentTitle={activeTab.title} onUpdate={handleUpdateTabTitle} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={settings} onUpdate={setSettings} themes={ThemeRegistry.getAllThemes()} availableFonts={systemFonts} />
      <ConfirmModal isOpen={confirmModalConfig.isOpen} onClose={() => setConfirmModalConfig({ isOpen: false, idToClose: null })} onConfirm={() => { if (confirmModalConfig.idToClose) handleConfirmCloseTab(confirmModalConfig.idToClose); }} title="Close Tab" message="Are you sure you want to close this scratchpad? Any unsaved changes will be lost." confirmLabel="Close Tab" isDanger />
    </div>
  );
}
