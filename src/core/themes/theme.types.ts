export interface VSCodeTheme {
  name: string;
  type: 'dark' | 'light';
  colors: { [key: string]: string };
  tokenColors?: Array<{
    name?: string;
    scope?: string | string[];
    settings: {
      foreground?: string;
      fontStyle?: string;
    };
  }>;
}

export interface ThemeMapping {
  // Mapping of VS Code color keys to our CSS variables
  '--bg-primary': string;
  '--bg-secondary': string;
  '--bg-toolbar': string;
  '--text-primary': string;
  '--text-muted': string;
  '--border-color': string;
  '--border-highlight': string;
  '--accent-color': string;
}

export const VSCODE_TO_UI_MAP: { [key in keyof ThemeMapping]: string | string[] } = {
  '--bg-primary': ['editor.background', 'sideBar.background'],
  '--bg-secondary': ['sideBar.background', 'editor.background'],
  '--bg-toolbar': ['titleBar.activeBackground', 'editor.background'],
  '--text-primary': ['editor.foreground', 'sideBar.foreground'],
  '--text-muted': ['descriptionForeground', 'sideBar.foreground'],
  '--border-color': ['sideBar.border', 'editorGroup.border'],
  '--border-highlight': ['focusBorder', 'activityBar.activeBorder'],
  '--accent-color': ['button.background', 'activityBarBadge.background']
};
