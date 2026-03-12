import { useEffect, useState, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { initVimMode } from 'monaco-vim';
import { ThemeRegistry } from '../../core/themes/ThemeRegistry';

interface CodeEditorProps {
  code: string;
  onChange: (value: string | undefined) => void;
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => void;
  theme?: string;
  fontSize?: number;
  wordWrap?: 'on' | 'off';
  lineNumbers?: 'on' | 'off';
  fontFamily?: string;
  renderWhitespace?: 'none' | 'boundary' | 'all';
  highlightActiveLine?: boolean;
  vimKeys?: boolean;
  autoCloseBrackets?: boolean;
  autocomplete?: boolean;
  linting?: boolean;
  hoverInfo?: boolean;
  signatures?: boolean;
  markers?: monaco.editor.IMarkerData[];
  language?: string;
  jsxEnabled?: boolean;
}

export function CodeEditor({ 
  code, 
  onChange, 
  onMount, 
  theme = 'vs-dark', 
  fontSize = 14,
  wordWrap = 'on',
  lineNumbers = 'on',
  fontFamily = "'JetBrains Mono', monospace",
  renderWhitespace = 'none',
  highlightActiveLine = true,
  vimKeys = false,
  autoCloseBrackets = true,
  autocomplete = true,
  linting = true,
  hoverInfo = true,
  signatures = false,
  markers = [],
  language = 'javascript',
  jsxEnabled = false
}: CodeEditorProps) {
  const monaco = useMonaco();
  const [isReady, setIsReady] = useState(false);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const vimModeRef = useRef<{ dispose: () => void } | null>(null);
  const vimStatusRef = useRef<HTMLDivElement>(null);
  const monacoThemeId = ThemeRegistry.getThemeMonacoId(theme);
  const decorationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (monaco) {
      ThemeRegistry.registerThemesInMonaco(monaco);
      monaco.editor.setTheme(monacoThemeId);
      
      // Configure JSX support if enabled
      if (jsxEnabled) {
        const compilerOptions = {
          jsx: 1, // JsxEmit.React
          allowNonTsExtensions: true,
          target: 99, // ScriptTarget.ESNext
          allowJs: true,
        };
        (monaco.languages as any).typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
        (monaco.languages as any).typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
      } else {
        // Default options without JSX
        const defaultOptions = {
          allowNonTsExtensions: true,
          target: 99, // ScriptTarget.ESNext
          allowJs: true,
        };
        (monaco.languages as any).typescript.typescriptDefaults.setCompilerOptions(defaultOptions);
        (monaco.languages as any).typescript.javascriptDefaults.setCompilerOptions(defaultOptions);
      }

      // Use setTimeout to avoid synchronous setState during render cycle warning
      const timer = setTimeout(() => setIsReady(true), 10);
      return () => clearTimeout(timer);
    }
  }, [monaco, monacoThemeId, jsxEnabled]);

  // 2. Handle Vim Mode
  useEffect(() => {
    if (!editorInstance || !vimStatusRef.current) return;

    if (vimKeys) {
      if (!vimModeRef.current) {
        // Initialize Vim mode with a small delay to ensure DOM and editor are fully ready
        const timer = setTimeout(() => {
          try {
            // Re-check vimKeys in case it was toggled off during the delay
            if (vimKeys && editorInstance && vimStatusRef.current && !vimModeRef.current) {
              vimModeRef.current = initVimMode(editorInstance, vimStatusRef.current);
              console.log('Vim mode initialized successfully');
            }
          } catch (err) {
            console.error('Failed to initialize Vim mode:', err);
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      if (vimModeRef.current) {
        // Dispose Vim mode
        vimModeRef.current.dispose();
        vimModeRef.current = null;
        if (vimStatusRef.current) vimStatusRef.current.innerHTML = '';
      }
    }

    return () => {
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    };
  }, [editorInstance, vimKeys]);

  // 3. Handle Markers (Linting/Errors/Syntax)
  useEffect(() => {
    if (!monaco || !editorInstance) return;
    
    const model = editorInstance.getModel();
    if (!model) return;

    const updateAllDecorations = () => {
      // Get internal markers (syntax/TS errors)
      const internalMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
      
      // Combine with prop markers (runtime errors)
      // Only show if linting is actually ON
      const allMarkers = linting ? [...markers, ...internalMarkers] : [];
      

      // 1. Sync markers with model for underlining (for prop markers)
      // We always show squigglies if Monaco shows them, but we control our own 'owner' markers
      monaco.editor.setModelMarkers(model, 'owner', linting ? markers : []);

      // 2. Add high-visibility decorations (glyphs + borders)
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = allMarkers.map(marker => {
        const isError = marker.severity === 8; // monaco.MarkerSeverity.Error
        const startLine = marker.startLineNumber || 1;
        
        return {
          range: new monaco.Range(startLine, 1, startLine, 1),
          options: {
            isWholeLine: true,
            className: '', // Removed error-line-border to prevent solid red bands
            marginClassName: isError ? 'error-marker' : 'warning-marker',
            glyphMarginClassName: isError ? 'error-marker' : 'warning-marker',
            glyphMarginHoverMessage: { value: marker.message },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        };
      });

      decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, newDecorations);
    };

    // Initial update
    updateAllDecorations();

    // Listen to changes in internal markers
    const disposable = monaco.editor.onDidChangeMarkers(() => {
      updateAllDecorations();
    });

    return () => {
      disposable.dispose();
      if (monaco && model) {
        monaco.editor.setModelMarkers(model, 'owner', []);
      }
      if (editorInstance && decorationIdsRef.current.length > 0) {
        editorInstance.deltaDecorations(decorationIdsRef.current, []);
        decorationIdsRef.current = [];
      }
    };
  }, [monaco, editorInstance, markers, linting]);

  const handleEditorWillMount = (m: typeof monaco | null) => {
    if (m) {
      ThemeRegistry.registerThemesInMonaco(m);
    }
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => {
    if (m) {
      ThemeRegistry.registerThemesInMonaco(m);
      m.editor.setTheme(monacoThemeId);
      setEditorInstance(editor);
      if (onMount) onMount(editor, m);
    }
  };

  return (
    <div style={{ 
      height: '100%', 
      width: '100%', 
      paddingTop: '8px', 
      backgroundColor: 'var(--bg-primary)', 
      position: 'relative',
      overflow: 'hidden'
    }}>
      {!isReady ? (
        <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-primary)' }} />
      ) : (
        <Editor
          key={`${monacoThemeId}-${fontSize}-${language}`}
          height="100%"
          language={language}
          theme={monacoThemeId}
          value={code}
          onChange={onChange}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: fontSize,
            fontFamily: fontFamily,
            fontLigatures: true,
            wordWrap: wordWrap,
            lineNumbers: lineNumbers,
            renderWhitespace: renderWhitespace,
            renderLineHighlight: highlightActiveLine ? 'all' : 'none',
            scrollBeyondLastLine: false,
            padding: { top: 8 },
            automaticLayout: true,
            autoClosingBrackets: autoCloseBrackets ? 'always' : 'never',
            quickSuggestions: autocomplete,
            suggestOnTriggerCharacters: autocomplete,
            parameterHints: { enabled: signatures },
            hover: { enabled: hoverInfo },
            glyphMargin: linting, 
            lineDecorationsWidth: linting ? 10 : 0, 
            lineNumbersMinChars: 3,
            folding: true,
            fixedOverflowWidgets: true,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              vertical: 'visible',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
              verticalHasArrows: false,
              horizontalHasArrows: false
            }
          }}
        />
      )}
      {/* Vim Status Bar */}
      <div 
        ref={vimStatusRef} 
        className="vim-status-bar"
        style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          height: vimKeys ? '24px' : '0px',
          backgroundColor: 'var(--bg-toolbar)', 
          color: 'var(--text-muted)',
          fontSize: '11px',
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderTop: vimKeys ? '1px solid var(--border-color)' : 'none',
          zIndex: 10,
          transition: 'height 0.2s ease-in-out',
          overflow: 'hidden'
        }}
      />
    </div>
  );
}







