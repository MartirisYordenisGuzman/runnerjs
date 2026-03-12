import type { VSCodeTheme } from './theme.types';
import { VSCODE_TO_UI_MAP } from './theme.types';
import type * as monaco from 'monaco-editor';




export class ThemeRegistry {
  private static themes: Map<string, VSCodeTheme> = new Map();
  private static activeThemeName: string = 'Dark';

  private static getMonacoId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  static registerTheme(theme: VSCodeTheme) {
    this.themes.set(theme.name, theme);
  }

  static getTheme(name: string): VSCodeTheme | undefined {
    return this.themes.get(name);
  }

  static getAllThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  static applyTheme(name: string) {
    const theme = this.getTheme(name);
    if (!theme) {
      console.warn(`Theme "${name}" not found in registry.`);
      return;
    }

    this.activeThemeName = name;
    
    // 1. Apply to UI (CSS Variables)
    try {
      const root = document.documentElement;
      Object.entries(VSCODE_TO_UI_MAP).forEach(([cssVar, vsKeys]) => {
        const keys = Array.isArray(vsKeys) ? vsKeys : [vsKeys];
        let color: string | undefined;
        
        for (const key of keys) {
          if (theme.colors && theme.colors[key]) {
            color = theme.colors[key];
            break;
          }
        }

        if (color) {
          root.style.setProperty(cssVar, color);
        } else if (cssVar === '--editor-line-highlight') {
          // Force fallback for line highlight to prevent red defaults
          root.style.setProperty(cssVar, theme.type === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)');
        } else if (cssVar === '--editor-selection') {
          // Force fallback for selection to prevent red defaults - use a subtle blue tint
          root.style.setProperty(cssVar, theme.type === 'dark' ? 'rgba(60, 116, 255, 0.3)' : 'rgba(0, 120, 215, 0.15)');
        }
      });
    } catch (err) {
      console.error('Failed to apply UI theme variables', err);
    }

    // 2. Monaco theme definition should be handled in the editor component
    // or globally via loader.
  }

  static registerThemesInMonaco(m: typeof monaco | null) {
    if (!m) return;
    
    this.getAllThemes().forEach(name => {
      const themeData = this.getTheme(name);
      if (!themeData) return;

      const monacoId = this.getMonacoId(name);
      const isBuiltIn = monacoId === 'vs-dark' || monacoId === 'vs-light' || monacoId === 'hc-black';
      if (isBuiltIn) return;

      try {
        const rules: monaco.editor.ITokenThemeRule[] = [];
        const standardTokens = [
          'keyword', 'string', 'comment', 'number', 'type', 'function', 
          'variable', 'delimiter', 'operator', 'identifier', 'tag', 
          'attribute.name', 'attribute.value'
        ];
        const tokenColorsMap = new Map<string, { foreground?: string; fontStyle?: string; priority: number }>();

        (themeData.tokenColors || []).forEach((tc: { scope?: string | string[]; settings: { foreground?: string; fontStyle?: string } }) => {
          const scopes = Array.isArray(tc.scope) ? tc.scope : [tc.scope || ''];
          scopes.forEach((scope: string) => {
            if (!scope) return;
            
            // 1. Direct registration of the TextMate scope
            rules.push({ token: scope, foreground: tc.settings.foreground, fontStyle: tc.settings.fontStyle });
            
            // 2. Heuristic mapping to Monaco's standard tokens
            const s = scope.toLowerCase();
            let mappedCategory = '';
            const priority = s.length;

            if (s.includes('comment')) mappedCategory = 'comment';
            else if (s.includes('string')) mappedCategory = 'string';
            else if (s.includes('keyword') || s.includes('storage') || s.includes('constant.language')) mappedCategory = 'keyword';
            else if (s.includes('number') || s.includes('constant.numeric')) mappedCategory = 'number';
            else if (s.includes('type') || s.includes('class') || s.includes('support.type')) mappedCategory = 'type';
            else if (s.includes('function') || s.includes('method') || s.includes('support.function')) mappedCategory = 'function';
            else if (s.includes('variable') || s.includes('identifier') || s.includes('support.variable')) {
              mappedCategory = 'variable';
              // Also map to identifier as it's very common in Monaco grammars
              const existingId = tokenColorsMap.get('identifier');
              if (!existingId || priority >= existingId.priority) {
                tokenColorsMap.set('identifier', { ...tc.settings, priority });
              }
            }
            else if (s.includes('punctuation') || s.includes('delimiter') || s.includes('separator')) mappedCategory = 'delimiter';
            else if (s.includes('operator')) mappedCategory = 'operator';
            else if (s.includes('tag')) mappedCategory = 'tag';
            else if (s.includes('attribute')) mappedCategory = 'attribute.name';

            if (mappedCategory && standardTokens.includes(mappedCategory)) {
              const existing = tokenColorsMap.get(mappedCategory);
              // Overwrite if this scope is more specific (longer) or equally specific but later
              if (!existing || priority >= existing.priority) {
                tokenColorsMap.set(mappedCategory, { ...tc.settings, priority });
              }
            }
          });
        });

        tokenColorsMap.forEach((settings, token) => {
          rules.push({ token, foreground: settings.foreground, fontStyle: settings.fontStyle });
        });

        if (themeData.colors['editor.foreground']) {
          rules.push({ token: '', foreground: themeData.colors['editor.foreground'] });
        }

        m.editor.defineTheme(monacoId, {
          base: themeData.type === 'light' ? 'vs' : 'vs-dark',
          inherit: true,
          rules,
          colors: {
            ...themeData.colors,
            'editor.background': themeData.colors['editor.background'] || (themeData.type === 'light' ? '#ffffff' : '#1e1e1e'),
            'editor.foreground': themeData.colors['editor.foreground'] || (themeData.type === 'light' ? '#333333' : '#d4d4d4'),
            'editor.lineHighlightBackground': themeData.colors['editor.lineHighlightBackground'] || (themeData.type === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)'),
            'editor.lineHighlightBorder': '#00000000',
            'editor.selectionBackground': themeData.colors['editor.selectionBackground'] || (themeData.type === 'dark' ? 'rgba(60, 116, 255, 0.3)' : 'rgba(0, 120, 215, 0.15)'),
          } as { [key: string]: string }
        });
      } catch (err) {
        console.error(`ThemeRegistry: Failed to define theme ${name} (as ${monacoId})`, err);
      }
    });
  }

  static getThemeMonacoId(name: string): string {
    return this.getMonacoId(name);
  }


  static getActiveThemeName(): string {
    return this.activeThemeName;
  }
}
