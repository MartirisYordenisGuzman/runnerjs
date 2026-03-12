import { useState, useEffect, useRef, useCallback } from 'react';
import Split from 'react-split';
import { Play, Square, Settings, Bookmark, Download, MessageSquare, Menu, Plus, X, Minus, AppWindow, ChevronRight } from 'lucide-react';
import { CodeEditor } from '../editor';
import { ConsolePanel } from '../console';
import { SnippetsModal } from './SnippetsModal';
import { EnvVarsModal } from './EnvVarsModal';
import { NpmPackagesModal } from './NpmPackagesModal';
import { EditTitleModal } from './EditTitleModal';
import { SettingsModal } from './SettingsModal';
import { ConfirmModal } from './ConfirmModal';
import type { AppSettings, ConsoleLogMessage, ExecutionCompleteMessage, Snippet, ElectronAPI } from '../../shared/ipc';
import type * as monaco from 'monaco-editor';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
import { ThemeRegistry } from '../../core/themes/ThemeRegistry';
import { registerDefaultThemes } from '../../core/themes/default-themes';
import { registerSnippetSuggestions } from '../../core/snippets/SnippetRegistry';
import { Check } from 'lucide-react';

// Initialize themes once at module level
registerDefaultThemes();

declare global {

  interface Window {
    electronAPI: {
      executeCode: (code: string, cwd?: string, env?: Record<string, string>) => Promise<ExecutionCompleteMessage>;
      onExecutionComplete: (callback: (result: ExecutionCompleteMessage) => void) => void;
      onConsoleOutput: (callback: (output: ConsoleLogMessage) => void) => void;
      onWorkerStatus: (callback: (status: 'running' | 'stopped') => void) => void;
      removeListeners: () => void;

      windowControls: (action: 'minimize' | 'maximize' | 'close' | 'bring-to-front') => void;
      openFile: () => Promise<{ canceled: boolean; filePath?: string; content?: string; error?: string }>;
      saveFile: (content: string, filePath?: string) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
      stopExecution: () => void;
      
      selectWorkingDirectory: () => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
      getSnippets: () => Promise<Snippet[]>;
      saveSnippet: (snippet: Snippet) => Promise<{ success: boolean; error?: string }>;
      deleteSnippet: (id: string) => Promise<{ success: boolean; error?: string }>;

      getEnvVars: () => Promise<Record<string, string>>;
      saveEnvVars: (envVars: Record<string, string>) => Promise<{ success: boolean; error?: string }>;

      installPackage: (name: string, cwd: string) => Promise<{ success: boolean; output: string; error?: string }>;
      uninstallPackage: (name: string, cwd: string) => Promise<{ success: boolean; output: string; error?: string }>;
      listPackages: (cwd: string) => Promise<{ name: string; version: string }[]>;
      searchPackages: (query: string) => Promise<{ name: string; version: string }[]>;

      setZoomFactor: (factor: number) => Promise<boolean>;
      getZoomFactor: () => Promise<number>;

      getSettings: () => Promise<AppSettings | null>;
      saveSettings: (settings: AppSettings) => Promise<{ success: boolean; error?: string }>;
    }
  }
}

interface TabData {
  id: string;
  title: string;
  code: string;
  logs: ConsoleLogMessage[];
  executionTime?: number;
  filePath?: string;
}

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
  
  const [theme, setTheme] = useState(ThemeRegistry.getActiveThemeName() || 'Dark');
  const [fontSize, setFontSize] = useState(14);
  const zoomFactorRef = useRef(1);
  const [cwd, setCwd] = useState<string | undefined>(undefined);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  const [isEnvVarsModalOpen, setIsEnvVarsModalOpen] = useState(false);
  const [isNpmModalOpen, setIsNpmModalOpen] = useState(false);
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState(false);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isOutputVisible, setIsOutputVisible] = useState(true);
  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{ 
    isOpen: boolean, 
    idToClose: string | null 
  }>({ isOpen: false, idToClose: null });
  const [settings, setSettings] = useState<AppSettings>({
    general: {
      autoRun: true,
      lineWrap: true,
      vimKeys: false,
      autoCloseBrackets: true,
      scrolling: 'Automatic',
      confirmClose: false,
      autocomplete: true,
      linting: true,
      hoverInfo: true,
      signatures: false
    },
    build: {
      transform: { typescript: true, jsx: false },
      proposals: {
        optionalChaining: false,
        regexpModifiers: false,
        doExpressions: false,
        functionSent: false,
        pipelineOperator: false,
        partialApplication: false,
        throwExpressions: false,
        decorators: false
      }
    },
    formatting: {
      autoFormat: false,
      printWidth: 80,
      tabWidth: 2,
      semicolons: true,
      singleQuotes: false,
      quoteProps: 'as-needed',
      jsxQuotes: false,
      trailingCommas: 'es5',
      bracketSpacing: true,
      arrowFunctionParentheses: 'always'
    },
    appearance: {
      theme: 'Monokai',
      font: 'JetBrains Mono',
      fontSize: 14,
      showLineNumbers: true,
      showInvisibles: false,
      highlightActiveLine: false,
      showTabBar: true,
      outputHighlighting: true,
      showActivityBar: true
    },
    ai: {
      openaiModel: 'GPT-4.1 mini',
      openaiApiKey: ''
    },
    advanced: {
      expressionResults: true,
      matchLines: true,
      showUndefined: false,
      loopProtection: true
    }
  });
  const [markers, setMarkers] = useState<monaco.editor.IMarkerData[]>([]);

  useEffect(() => {
    // Load persisted settings on mount
    const loadSettings = async () => {
      try {
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) {
          setSettings(savedSettings);
          if (savedSettings.appearance?.theme) setTheme(savedSettings.appearance.theme);
          if (savedSettings.appearance?.fontSize) setFontSize(savedSettings.appearance.fontSize);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();
  }, []);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Save settings whenever they change (debounced)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      window.electronAPI.saveSettings(settings);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [settings]);

  // Sync theme/font size state with settings for backward compatibility if needed, 
  // or just use settings directly. Let's sync for now to avoid breaking other things.
  useEffect(() => {
    setTheme(settings.appearance.theme);
    setFontSize(settings.appearance.fontSize);
  }, [settings.appearance.theme, settings.appearance.fontSize]);

  // Initial load of env vars and zoom
  useEffect(() => {
    window.electronAPI.getEnvVars().then(setEnvVars);
    window.electronAPI.getZoomFactor().then((f: number) => {
      zoomFactorRef.current = f;
    });
  }, []);


  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null); // Store Monaco editor instance

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => {
    editorRef.current = editor;
    editor.focus();
    // Ensure snippets are registered once the editor is ready
    window.electronAPI.getSnippets().then((data: Snippet[]) => {
      registerSnippetSuggestions(m, data);
    });
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    window.electronAPI.onExecutionComplete((data: ExecutionCompleteMessage) => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, executionTime: data.executionTimeMs } : t));
      setIsRunning(false);
      
      if (!data.success && (data.error || data.stack)) {
        const parsedMarkers = parseErrorStack(data.stack || data.error || '');
        setMarkers(parsedMarkers);
      } else {
        setMarkers([]);
      }
    });

    window.electronAPI.onConsoleOutput((log: ConsoleLogMessage) => {
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === activeTabId ? { ...tab, logs: [...tab.logs, log] } : tab
      ));
    });

    window.electronAPI.onWorkerStatus((status: 'running' | 'stopped') => {
      console.log(`[UI] Worker status received: ${status}`);
      setIsRunning(status === 'running');
    });

    return () => {
      window.electronAPI.removeListeners();
    };
  }, [activeTabId]);



  useEffect(() => {
    ThemeRegistry.applyTheme(theme);
  }, [theme]);

  // No longer needed here as it is handled in handleEditorDidMount


  const changeFontSize = useCallback((delta: number) => {
    setFontSize(prev => Math.max(8, Math.min(48, prev + delta)));
  }, []);

  const handleZoom = useCallback(async (delta: number | 'reset') => {
    try {
      let newZoom = 1;
      if (delta === 'reset') {
        newZoom = 1.0;
      } else {
        newZoom = Math.max(0.4, Math.min(3.0, zoomFactorRef.current + delta));
      }
      
      if (newZoom === zoomFactorRef.current && delta !== 'reset') return;
      
      zoomFactorRef.current = newZoom;
      await window.electronAPI.setZoomFactor(newZoom);
    } catch (err) {
      console.error('[Zoom] Failed to change zoom:', err);
    }
  }, []);

  const parseErrorStack = (stack: string): monaco.editor.IMarkerData[] => {
    if (!stack) return [];
    
    // Split stack into lines and look for the first line that indicates the error location
    // In our VM context, it usually looks like "at evalmachine.<anonymous>:3:1" 
    // or just has the :line:col pattern.
    const lines = stack.split('\n');
    let locationLine = '';
    
    // Skip the first line as it's typically the error message
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].includes('<anonymous>') || lines[i].includes('evalmachine')) {
        locationLine = lines[i];
        break;
      }
    }
    
    // Fallback to searching all lines if no specific marker found
    if (!locationLine) {
       for (const line of lines) {
         if (/:(\d+):(\d+)/.test(line)) {
           locationLine = line;
           break;
         }
       }
    }

    if (locationLine) {
      const regex = /:(\d+):(\d+)/;
      const match = locationLine.match(regex);
      
      if (match) {
        const line = parseInt(match[1], 10);
        const col = parseInt(match[2], 10);
        
        console.log(`[Workspace] Parsed error location: line ${line}, col ${col}`);
        
        return [{
          severity: 8, // monaco.MarkerSeverity.Error,
          message: lines[0], // Error message is on the first line
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: col + 1,
        }];
      }
    }
    
    console.warn('[Workspace] Could not parse error location from stack:', stack);
    return [];
  };

  const runCode = useCallback(async (codeToRun: string, tabId: string) => {
    setMarkers([]); // Clear markers before run
    setIsRunning(true);
    // Clear logs for this tab before execution
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, logs: [] } : t));
    
    try {
      const result = await window.electronAPI.executeCode(codeToRun, cwd, envVars);
      
      setTabs(prev => prev.map(t => {
        if (t.id !== tabId) return t;
        
        const newLogs = [...t.logs];
        if (result.error) {
           newLogs.push({ type: 'error', value: [result.error], timestamp: Date.now() });
        } else if (result.result !== undefined) {
           newLogs.push({ type: 'log', value: ['=>', String(result.result)], timestamp: Date.now() });
        }
        return { ...t, logs: newLogs, executionTime: result.executionTimeMs };
      }));
      
    } catch (err) {
      setTabs(prev => prev.map(t => t.id === tabId 
        ? { ...t, logs: [...t.logs, { type: 'error', value: [err instanceof Error ? err.message : String(err)], timestamp: Date.now() }] } 
        : t
      ));
    }
  }, [cwd, envVars]);

  useEffect(() => {
    if (!settings.general.autoRun) return;
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runCode(activeTab.code, activeTabId);
    }, 500); 

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeTab.code, activeTabId, cwd, runCode, settings.general.autoRun]);

  const stopCode = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    window.electronAPI.stopExecution();
    setIsRunning(false);
  }, []);

  const createNewTab = useCallback(() => {
    const newId = `tab-${Date.now()}`;
    setTabs(prev => [...prev, {
      id: newId,
      title: 'Untitled',
      code: '// New Scratchpad\n',
      logs: []
    }]);
    setActiveTabId(newId);
  }, []);

  const closeTab = (e: React.MouseEvent, idToClose: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // Prevent closing the last tab

    if (settings.general.confirmClose) {
      setConfirmModalConfig({ isOpen: true, idToClose });
      return;
    }
    
    handleConfirmCloseTab(idToClose);
  };

  const handleConfirmCloseTab = (idToClose: string) => {
    const newTabs = tabs.filter(t => t.id !== idToClose);
    setTabs(newTabs);
    
    if (activeTabId === idToClose) {
      const remainingTabs = tabs.filter(t => t.id !== idToClose);
      setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
    }
  };

  const updateActiveTabCode = useCallback((newCode: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, code: newCode } : t));
  }, [activeTabId]);

  const handleOpenFile = useCallback(async () => {
    const result = await window.electronAPI.openFile();
    if (!result.canceled && result.filePath && result.content !== undefined) {
      const fileName = result.filePath.replace(/\\/g, '/').split('/').pop() || 'Untitled';
      
      if (activeTab.title === 'Untitled' && activeTab.code === '// New Scratchpad\n') {
        // Reuse current empty tab
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: fileName, code: result.content!, filePath: result.filePath } : t));
      } else {
        // Creates a new tab
        const newId = `tab-${Date.now()}`;
        setTabs(prev => [...prev, {
          id: newId,
          title: fileName,
          code: result.content!,
          logs: [],
          filePath: result.filePath
        }]);
        setActiveTabId(newId);
      }
    }
    setIsMenuOpen(false);
    setActiveSubmenu(null);
  }, [activeTab.code, activeTab.title, activeTabId]);

  const handleSaveFile = useCallback(async (saveAs: boolean = false) => {
    const targetPath = saveAs ? undefined : activeTab.filePath;
    const result = await window.electronAPI.saveFile(activeTab.code, targetPath);
    
    if (!result.canceled && result.filePath) {
      const fileName = result.filePath.replace(/\\/g, '/').split('/').pop() || 'Untitled';
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: fileName, filePath: result.filePath } : t));
    }
    setIsMenuOpen(false);
    setActiveSubmenu(null);
  }, [activeTab.code, activeTab.filePath, activeTabId]);

  const handleSetWorkingDirectory = async () => {
    const result = await window.electronAPI.selectWorkingDirectory();
    if (!result.canceled && result.filePath) {
      setCwd(result.filePath);
    }
    setIsMenuOpen(false);
    setActiveSubmenu(null);
  };

  const handleUpdateTabTitle = (newTitle: string) => {
    setTabs(prevTabs => prevTabs.map(tab => 
      tab.id === activeTabId ? { ...tab, title: newTitle } : tab
    ));
  };

  const [isSnippetsModalOpen, setIsSnippetsModalOpen] = useState(false);

  const handleInsertSnippet = (code: string, newTab: boolean) => {
    if (newTab) {
      const newId = `tab-${Date.now()}`;
      setTabs(prev => [...prev, {
        id: newId,
        title: 'New Snippet',
        code: code,
        logs: []
      }]);
      setActiveTabId(newId);
    } else {
      // Insert at cursor position if editor is available
      if (editorRef.current) {
        const editor = editorRef.current;
        const selection = editor.getSelection();
        if (selection) {
          editor.executeEdits('snippet-insert', [
            {
              range: selection,
              text: code,
              forceMoveMarkers: true
            }
          ]);
          editor.focus();
        }
      } else {
        // Fallback to replacing whole code if editor is not yet mounted
        updateActiveTabCode(code);
      }
    }
    setIsSnippetsModalOpen(false);
  };

  const executeEditorCommand = useCallback(async (command: string) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      
      if (command === 'clear') {
        updateActiveTabCode('');
      } else if (command === 'editor.action.clipboardCopyAction' || command === 'editor.action.clipboardCutAction') {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (selection && model && !selection.isEmpty()) {
          const text = model.getValueInRange(selection);
          try {
            await navigator.clipboard.writeText(text);
            if (command === 'editor.action.clipboardCutAction') {
               editor.executeEdits('cut-command', [{
                  range: selection,
                  text: '',
                  forceMoveMarkers: true
               }]);
               editor.pushUndoStop();
            }
          } catch (err) {
            console.error('Failed to access clipboard', err);
          }
        }
      } else if (command === 'editor.action.clipboardPasteAction') {
        try {
          const text = await navigator.clipboard.readText();
          const selection = editor.getSelection();
          if (selection && text) {
             editor.executeEdits('paste-command', [{
               range: selection,
               text: text,
               forceMoveMarkers: true
             }]);
             editor.pushUndoStop();
          }
        } catch (err) {
           console.error('Failed to read clipboard', err);
        }
      } else {
        editor.trigger('keyboard', command, null);
      }
      
      // Return focus to editor
      editor.focus();
    }
    setIsMenuOpen(false);
    setActiveSubmenu(null);
  }, [updateActiveTabCode]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();
      const code = e.code;

      if (isCtrl) {
        // Handle Zoom and Font Size with high priority
        if (code === 'Equal' || code === 'NumpadAdd') {
          e.preventDefault();
          if (isShift) changeFontSize(1);
          else handleZoom(0.1);
          return;
        }
        if (code === 'Minus' || code === 'NumpadSubtract') {
          e.preventDefault();
          if (isShift) changeFontSize(-1);
          else handleZoom(-0.1);
          return;
        }
        if (code === 'Digit0' || code === 'Numpad0') {
          e.preventDefault();
          handleZoom('reset');
          setFontSize(14);
          return;
        }

        switch (key) {
          case 'i':
            e.preventDefault();
            executeEditorCommand('editor.action.triggerSuggest');
            break;
          case 'p':
            e.preventDefault();
            setIsNpmModalOpen(prev => !prev);
            break;
          case 'r':
            e.preventDefault();
            if (isShift) stopCode();
            else runCode(activeTab.code, activeTabId);
            break;
          case 'k':
            e.preventDefault();
            stopCode();
            break;
          case 'b':
            e.preventDefault();
            setIsSnippetsModalOpen(prev => !prev);
            break;
          case 'n':
            e.preventDefault();
            createNewTab();
            break;
          case 'o':
            e.preventDefault();
            handleOpenFile();
            break;
          case 's':
            e.preventDefault();
            handleSaveFile(isShift); // Ctrl+Shift+S for Save As
            break;
          case '\\':
            e.preventDefault();
            setIsSidebarVisible(prev => !prev);
            break;
          case 'j':
            e.preventDefault();
            setIsOutputVisible(prev => !prev);
            break;
          case 'm':
            e.preventDefault();
            window.electronAPI.windowControls('minimize');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture to intercept before Monaco
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeTab.code, activeTabId, runCode, stopCode, createNewTab, handleOpenFile, handleSaveFile, setIsNpmModalOpen, setIsSnippetsModalOpen, executeEditorCommand, handleZoom, changeFontSize]);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)' }}>

      {/* Left Sidebar (App Navigation) */}
      {isSidebarVisible && (
        <div style={{ 
          width: '56px', 
          backgroundColor: '#202124', 
          borderRight: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '20px',
          paddingBottom: '20px',
          zIndex: 50,
          position: 'relative'
        }}>
        {/* Top Icons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
          <div 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            style={{ 
              cursor: 'pointer', 
              padding: '8px', 
              backgroundColor: isMenuOpen ? '#333' : 'transparent', 
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Menu size={22} color={isMenuOpen ? '#fff' : '#888'} />
          </div>
          <div style={{ width: '28px', height: '1px', backgroundColor: '#333' }} />
          <Play size={22} color="#888" style={{ cursor: 'pointer' }} onClick={() => runCode(activeTab.code, activeTabId)} />
          <Square size={20} color="#888" style={{ cursor: 'pointer', opacity: isRunning ? 1 : 0.5 }} onClick={isRunning ? stopCode : undefined} />
          <div style={{ width: '28px', height: '1px', backgroundColor: '#333' }} />
          <Bookmark size={22} color="#888" style={{ cursor: 'pointer' }} onClick={() => setIsSnippetsModalOpen(true)} />
          <Download size={22} color="#888" style={{ cursor: 'pointer' }} onClick={() => setIsNpmModalOpen(true)} />
          <MessageSquare size={22} color="#888" style={{ cursor: 'pointer' }} />
        </div>
        {/* Bottom Icons */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
          <Settings size={22} color="#888" style={{ cursor: 'pointer' }} onClick={() => setIsSettingsModalOpen(true)} />
        </div>
      </div>
    )}

      {/* Main Content Area */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1, 
        minWidth: 0, 
        position: 'relative',
      }}>


        
        {/* Floating Dropdown Menu */}
        {isMenuOpen && (
          <>
            {/* Invisible backdrop to detect outside clicks */}
            <div 
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} 
              onClick={() => {
                setIsMenuOpen(false);
                setActiveSubmenu(null);
              }}
            />
            
            {/* Main Menu Panel */}
            <div style={{
              position: 'fixed',
              top: '40px',
              left: '56px',
              width: '240px',
              backgroundColor: '#202124',
              borderRadius: '0 8px 8px 8px',
              boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
              border: '1px solid #333',
              borderLeft: 'none',
              zIndex: 50,
              padding: '8px 0',
              display: 'flex',
              flexDirection: 'column',
              color: '#d4d4d4',
              fontSize: '14px'
            }}>
              {['File', 'Edit', 'Action', 'Tools', 'View', 'Themes', 'Window', 'Help'].map((item) => (
                <div key={item} style={{
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: activeSubmenu === item ? '#333' : 'transparent',
                  transition: 'background-color 0.1s'
                }}
                onMouseEnter={() => setActiveSubmenu(item)}
                >
                  <span style={{ color: item === 'Action' ? '#eab308' : item === 'Help' ? '#eab308' : '#fff' }}>{item}</span>
                  <ChevronRight size={16} color="#888" />
                </div>
              ))}
            </div>

            {/* Submenus */}
            {activeSubmenu === 'File' && (
              <div 
                onMouseEnter={() => setActiveSubmenu('File')}
                style={{
                  position: 'fixed',
                  top: '40px',
                  left: '296px', // 56px (sidebar) + 240px (menu width)
                  width: '240px',
                  backgroundColor: '#202124',
                  borderRadius: '0 8px 8px 8px',
                  boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
                  border: '1px solid #333',
                  zIndex: 50,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#d4d4d4',
                  fontSize: '14px'
              }}>
                <div 
                  style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { createNewTab(); setIsMenuOpen(false); setActiveSubmenu(null); }}
                >
                  <span>New File</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+N</span>
                </div>
                <div 
                  style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={handleOpenFile}
                >
                  <span>Open...</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+O</span>
                </div>
                <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
                <div 
                  style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => handleSaveFile(false)}
                >
                  <span>Save</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+S</span>
                </div>
                <div 
                  style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => handleSaveFile(true)}
                >
                  <span>Save As...</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+Shift+S</span>
                </div>
                <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
                <div 
                  style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={(e) => { closeTab(e, activeTabId); setIsMenuOpen(false); setActiveSubmenu(null); }}
                >
                  <span>Close File</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+W</span>
                </div>
              </div>
            )}
            
            {activeSubmenu === 'Edit' && (
              <div 
                onMouseEnter={() => setActiveSubmenu('Edit')}
                style={{
                  position: 'fixed',
                  top: '40px',
                  left: '296px',
                  width: '280px',
                  backgroundColor: '#202124',
                  borderRadius: '0 8px 8px 8px',
                  boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
                  border: '1px solid #333',
                  zIndex: 50,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#d4d4d4',
                  fontSize: '14px'
              }}>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('undo')}>
                  <span>Undo</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+Z</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('redo')}>
                  <span>Redo</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+Shift+Z</span>
                </div>
                <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('editor.action.clipboardCutAction')}>
                  <span>Cut</span><span></span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('editor.action.clipboardCopyAction')}>
                  <span>Copy</span><span></span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('editor.action.clipboardPasteAction')}>
                  <span>Paste</span><span></span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('editor.action.selectAll')}>
                  <span>Select All</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+A</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('clear')}>
                  <span>Clear</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+Shift+K</span>
                </div>
                <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('actions.find')}>
                  <span>Find</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+F</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('editor.action.startFindReplaceAction')}>
                  <span>Replace</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Alt+Ctrl+F</span>
                </div>
                <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('editor.action.commentLine')}>
                  <span>Toggle Line Comment</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+/</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('editor.action.blockComment')}>
                  <span>Toggle Block Comment</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Alt+Ctrl+/</span>
                </div>
              </div>
            )}
            
            {activeSubmenu === 'Action' && (
              <div 
                onMouseEnter={() => setActiveSubmenu('Action')}
                style={{
                  position: 'fixed',
                  top: '40px',
                  left: '296px',
                  width: '280px',
                  backgroundColor: '#202124',
                  borderRadius: '0 8px 8px 8px',
                  boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
                  border: '1px solid #333',
                  zIndex: 50,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#d4d4d4',
                  fontSize: '14px'
              }}>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { runCode(activeTab.code, activeTabId); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Play size={14} color="#d4d4d4" fill="#d4d4d4" /><span>Run</span></div><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+R</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { stopCode(); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Square size={14} color="#d4d4d4" fill="#d4d4d4" /><span>Stop</span></div><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+Shift+R</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { stopCode(); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ width: '14px' }}/><span>Kill</span></div><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+K</span>
                </div>
                <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={handleSetWorkingDirectory}
                  >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ width: '14px' }}/><span>Set Working Directory...</span></div><span></span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => executeEditorCommand('editor.action.formatDocument')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ width: '14px' }}/><span>Format Code</span></div><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Alt+Shift+F</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setIsSnippetsModalOpen(true); setIsMenuOpen(false); setActiveSubmenu(null); }}
                  >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ width: '14px' }}/><span>Create Snippet...</span></div><span></span>
                </div>
              </div>
            )}

            {activeSubmenu === 'Tools' && (
              <div 
                onMouseEnter={() => setActiveSubmenu('Tools')}
                style={{
                  position: 'fixed',
                  top: '120px',
                  left: '296px',
                  width: '240px',
                  backgroundColor: '#202124',
                  borderRadius: '0 8px 8px 8px',
                  boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
                  border: '1px solid #333',
                  zIndex: 50,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#d4d4d4',
                  fontSize: '14px'
              }}>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setIsNpmModalOpen(true); setIsMenuOpen(false); setActiveSubmenu(null); }}
                  >
                  <span>NPM Packages...</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+P</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setIsEnvVarsModalOpen(true); setIsMenuOpen(false); setActiveSubmenu(null); }}
                  >
                  <span>Environment Variables...</span><span></span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setIsSnippetsModalOpen(true); setIsMenuOpen(false); setActiveSubmenu(null); }}
                  >
                  <span>Snippets...</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+B</span>
                </div>
              </div>
            )}

            {(activeSubmenu === 'View' || activeSubmenu === 'Layout') && (
              <div 
                onMouseEnter={() => setActiveSubmenu('View')}
                style={{
                  position: 'fixed',
                  top: '160px',
                  left: '296px',
                  width: '240px',
                  backgroundColor: '#202124',
                  borderRadius: '0 8px 8px 8px',
                  boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
                  border: '1px solid #333',
                  zIndex: 50,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#d4d4d4',
                  fontSize: '14px'
              }}>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { handleZoom('reset'); setFontSize(14); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <span>Actual Size</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+0</span>
                </div>

                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { changeFontSize(1); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <span>Increase Font Size</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+Shift++</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { changeFontSize(-1); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <span>Decrease Font Size</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+Shift+-</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { handleZoom(0.1); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <span>Zoom In</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl++</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { handleZoom(-0.1); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <span>Zoom Out</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+-</span>
                </div>


                <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setIsSidebarVisible(!isSidebarVisible); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <span>{isSidebarVisible ? 'Hide Activity Bar' : 'Show Activity Bar'}</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+\</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setIsOutputVisible(!isOutputVisible); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <span>{isOutputVisible ? 'Hide Output' : 'Show Output'}</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+J</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={() => setActiveSubmenu('Layout')}
                  onMouseLeave={() => {}}
                >
                  <span>Layout</span><ChevronRight size={14} color="#888" />
                </div>
              </div>
            )}

            {activeSubmenu === 'Layout' && (
              <div 
                onMouseEnter={() => setActiveSubmenu('Layout')}
                style={{
                  position: 'fixed',
                  top: '429px',
                  left: '536px',
                  width: '200px',
                  backgroundColor: '#202124',
                  borderRadius: '8px',
                  boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
                  border: '1px solid #333',
                  zIndex: 60,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#d4d4d4',
                  fontSize: '14px'
              }}>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setLayoutDirection('horizontal'); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {layoutDirection === 'horizontal' && <Check size={14} color="var(--accent-color)" />}
                    <span style={{ marginLeft: layoutDirection === 'horizontal' ? 0 : '22px' }}>Horizontal</span>
                  </div>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setLayoutDirection('vertical'); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {layoutDirection === 'vertical' && <Check size={14} color="var(--accent-color)" />}
                    <span style={{ marginLeft: layoutDirection === 'vertical' ? 0 : '22px' }}>Vertical</span>
                  </div>
                </div>
              </div>
            )}

            {activeSubmenu === 'Themes' && (
              <div 
                onMouseEnter={() => setActiveSubmenu('Themes')}
                style={{
                  position: 'fixed',
                  top: '180px',
                  left: '296px',
                  width: '260px',
                  backgroundColor: '#202124',
                  borderRadius: '0 8px 8px 8px',
                  boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
                  border: '1px solid #333',
                  zIndex: 50,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#d4d4d4',
                  fontSize: '14px',
                  maxHeight: '400px',
                  overflowY: 'auto'
              }}>
                {ThemeRegistry.getAllThemes().map((tName, i) => (
                  <div key={tName} style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => { setTheme(tName); setIsMenuOpen(false); setActiveSubmenu(null); }}>
                    <span style={{ color: theme === tName ? '#3b82f6' : 'transparent', width: '12px' }}><Check size={14}/></span>
                    <div style={{ display: 'flex', overflow: 'hidden', borderRadius: '2px', width: '40px', height: '12px', flexShrink: 0 }}>
                      <div style={{ flex: 1, backgroundColor: ['#3b82f6', '#f43f5e', '#a855f7', '#10b981', '#f59e0b'][i % 5] }}></div>
                      <div style={{ flex: 1, backgroundColor: ['#10b981', '#3b82f6', '#f43f5e', '#a855f7', '#1e1e1e'][i % 5] }}></div>
                      <div style={{ flex: 1, backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#3b82f6', '#f43f5e'][i % 5] }}></div>
                    </div>
                    <span style={{ flex: 1 }}>{tName}</span>
                  </div>
                ))}
              </div>
            )}

            {activeSubmenu === 'Window' && (
              <div 
                onMouseEnter={() => setActiveSubmenu('Window')}
                style={{
                  position: 'fixed',
                  top: '280px', // 7th item
                  left: '296px',
                  width: '260px',
                  backgroundColor: '#202124',
                  borderRadius: '0 8px 8px 8px',
                  boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
                  border: '1px solid #333',
                  zIndex: 50,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#d4d4d4',
                  fontSize: '14px'
              }}>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setIsEditTitleModalOpen(true); setIsMenuOpen(false); setActiveSubmenu(null); }}
                  >
                  <span>Edit tab title</span>
                </div>
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { window.electronAPI.windowControls('minimize'); setIsMenuOpen(false); setActiveSubmenu(null); }}
                  >
                  <span>Minimize</span><span style={{ color: '#888', fontSize: '11px', marginLeft: '32px' }}>Ctrl+M</span>
                </div>
                <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
                <div style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { window.electronAPI.windowControls('bring-to-front'); setIsMenuOpen(false); setActiveSubmenu(null); }}
                  >
                  <span>Bring All to Front</span>
                </div>
              </div>
            )}

          </>
        )}

        {/* Top Tab Bar (Like RunJS/Chrome) */}
        <div style={{ 
          height: '44px', 
          backgroundColor: '#282a2d', 
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '0px',
          paddingRight: '16px',
        }}>
          {tabs.map(tab => (
            <div 
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                backgroundColor: activeTabId === tab.id ? '#1e1e1e' : 'transparent', 
                height: '100%', 
                padding: '0 16px',
                borderTop: activeTabId === tab.id ? '2px solid transparent' : '2px solid transparent',
                borderRight: '1px solid #333',
                color: activeTabId === tab.id ? '#fff' : '#888',
                fontSize: '13px',
                gap: '12px',
                cursor: 'pointer',
              }}>
              <span style={{ color: activeTabId === tab.id ? '#3b82f6' : '#555', fontWeight: 500 }}>JS</span>
              <span>{tab.title}</span>
              <X 
                size={14} 
                color={activeTabId === tab.id ? '#888' : '#555'} 
                style={{ marginLeft: '12px', cursor: 'pointer' }} 
                onClick={(e) => closeTab(e, tab.id)}
              />
            </div>
          ))}
          <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', height: '100%' }}>
             <Plus size={18} color="#888" style={{ cursor: 'pointer' }} onClick={createNewTab} />
          </div>

          <div style={{ flex: 1, height: '100%', WebkitAppRegion: 'drag' } as React.CSSProperties} />
          
          {/* Custom Window Controls */}
          <div style={{ display: 'flex', gap: '20px', paddingLeft: '16px', alignItems: 'center', height: '100%' }}>
             <Minus size={16} color="#888" style={{ cursor: 'pointer' }} onClick={() => window.electronAPI.windowControls('minimize')} />
             <AppWindow size={14} color="#888" style={{ cursor: 'pointer' }} onClick={() => window.electronAPI.windowControls('maximize')} />
             <X size={16} color="#888" style={{ cursor: 'pointer' }} onClick={() => window.electronAPI.windowControls('close')} />
          </div>

        </div>

        {/* Editor & Console Split Panes */}
        {isOutputVisible ? (
          <Split 
            key={layoutDirection}
            sizes={[50, 50]} 
            minSize={100} 
            expandToMin={false} 
            gutterSize={1} 
            gutterAlign="center" 
            snapOffset={30} 
            dragInterval={1} 
            direction={layoutDirection} 
            cursor={layoutDirection === 'horizontal' ? 'col-resize' : 'row-resize'}
            style={{ display: 'flex', flexDirection: layoutDirection === 'horizontal' ? 'row' : 'column', flex: 1, minHeight: 0, width: '100%' }}
          >
            <div style={{ minHeight: 0, height: '100%', backgroundColor: 'var(--bg-primary)' }}>
              <CodeEditor 
                key={`${activeTabId}-${theme}-${fontSize}-${settings.general.vimKeys}`}
                code={activeTab.code} 
                onChange={(val: string | undefined) => updateActiveTabCode(val || '')} 
                onMount={handleEditorDidMount}
                theme={theme}
                fontSize={fontSize}
                wordWrap={settings.general.lineWrap ? 'on' : 'off'}
                lineNumbers={settings.appearance.showLineNumbers ? 'on' : 'off'}
                fontFamily={settings.appearance.font}
                renderWhitespace={settings.appearance.showInvisibles ? 'all' : 'none'}
                highlightActiveLine={settings.appearance.highlightActiveLine}
                autoCloseBrackets={settings.general.autoCloseBrackets}
                autocomplete={settings.general.autocomplete}
                linting={settings.general.linting}
                hoverInfo={settings.general.hoverInfo}
                signatures={settings.general.signatures}
                vimKeys={settings.general.vimKeys}
                markers={markers}
              />
            </div>

            <div style={{ 
              minHeight: 0, 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              borderLeft: layoutDirection === 'horizontal' ? '1px solid #333' : 'none',
              borderTop: layoutDirection === 'vertical' ? '1px solid #333' : 'none'
            }}>
              <ConsolePanel logs={activeTab.logs} executionTime={activeTab.executionTime} scrolling={settings.general.scrolling} />
            </div>
          </Split>
        ) : (
          <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', backgroundColor: 'var(--bg-primary)' }}>
            <CodeEditor 
              key={`${activeTabId}-${theme}-${fontSize}-${settings.general.vimKeys}`}
              code={activeTab.code} 
              onChange={(val: string | undefined) => updateActiveTabCode(val || '')} 
              onMount={handleEditorDidMount}
              theme={theme}
              fontSize={fontSize}
              wordWrap={settings.general.lineWrap ? 'on' : 'off'}
              lineNumbers={settings.appearance.showLineNumbers ? 'on' : 'off'}
              fontFamily={settings.appearance.font}
              renderWhitespace={settings.appearance.showInvisibles ? 'all' : 'none'}
              highlightActiveLine={settings.appearance.highlightActiveLine}
              autoCloseBrackets={settings.general.autoCloseBrackets}
              autocomplete={settings.general.autocomplete}
              linting={settings.general.linting}
              hoverInfo={settings.general.hoverInfo}
              signatures={settings.general.signatures}
              vimKeys={settings.general.vimKeys}
              markers={markers}
            />
          </div>
        )}
      </div>
      
      <SnippetsModal 
        isOpen={isSnippetsModalOpen} 
        onClose={() => setIsSnippetsModalOpen(false)} 
        onInsert={handleInsertSnippet}
        theme={theme}
      />

      <EnvVarsModal 
        isOpen={isEnvVarsModalOpen}
        onClose={() => setIsEnvVarsModalOpen(false)}
        envVars={envVars}
        onUpdate={setEnvVars}
      />

      <NpmPackagesModal 
        isOpen={isNpmModalOpen}
        onClose={() => setIsNpmModalOpen(false)}
        cwd={cwd}
        onChangeDirectory={handleSetWorkingDirectory}
      />

      <EditTitleModal 
        isOpen={isEditTitleModalOpen}
        onClose={() => setIsEditTitleModalOpen(false)}
        currentTitle={activeTab.title}
        onUpdate={handleUpdateTabTitle}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdate={setSettings}
        themes={ThemeRegistry.getAllThemes()}
      />

      <ConfirmModal 
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig({ isOpen: false, idToClose: null })}
        onConfirm={() => {
          if (confirmModalConfig.idToClose) {
            handleConfirmCloseTab(confirmModalConfig.idToClose);
          }
        }}
        title="Close Tab"
        message="Are you sure you want to close this scratchpad? Any unsaved changes will be lost."
        confirmLabel="Close Tab"
        isDanger={true}
      />
    </div>
  );
}
