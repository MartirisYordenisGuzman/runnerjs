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
  '--bg-primary': string;
  '--bg-secondary': string;
  '--bg-toolbar': string;
  '--bg-menu': string;
  '--bg-item-hover': string;
  '--text-primary': string;
  '--text-muted': string;
  '--border-color': string;
  '--border-highlight': string;
  '--accent-color': string;
  '--editor-line-highlight': string;
  '--editor-selection': string;
}

export const VSCODE_TO_UI_MAP: { [key in keyof ThemeMapping]: string | string[] } = {
  '--bg-primary': ['editor.background'],
  '--bg-secondary': ['editor.background', 'sideBar.background'],
  '--bg-toolbar': ['sideBar.background', 'titleBar.activeBackground', 'editor.background'],
  '--bg-menu': ['menu.background', 'list.hoverBackground', 'sideBar.background'],
  '--bg-item-hover': ['list.hoverBackground', 'menu.selectionBackground'],
  '--text-primary': ['editor.foreground', 'sideBar.foreground'],
  '--text-muted': ['descriptionForeground', 'sideBar.foreground'],
  '--border-color': ['sideBar.border', 'editorGroup.border', 'panel.border'],
  '--border-highlight': ['focusBorder', 'activityBar.activeBorder'],
  '--accent-color': ['button.background', 'activityBarBadge.background'],
  '--editor-line-highlight': ['editor.lineHighlightBackground'],
  '--editor-selection': ['editor.selectionBackground']
};
