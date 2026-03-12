import type { VSCodeTheme } from '../theme.types';

export const githubDarkTheme: VSCodeTheme = {
  name: 'GitHub Dark',
  type: 'dark',
  colors: {
    'editor.background': '#0d1117',
    'editor.foreground': '#c9d1d9',
    'sideBar.background': '#0d1117',
    'sideBar.foreground': '#c9d1d9',
    'titleBar.activeBackground': '#0d1117',
    'focusBorder': '#1f6feb',
    'activityBarBadge.background': '#1f6feb',
    'button.background': '#238636'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#8b949e', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#a5d6ff' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#79c0ff' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#c9d1d9' } },
    { scope: ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], settings: { foreground: '#ff7b72' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#d2a8ff' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#ffa657' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#7ee787' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#d2a8ff' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#ff7b72' } },
    { scope: ['variable.parameter'], settings: { foreground: '#ffa657', fontStyle: 'italic' } }
  ]
};
