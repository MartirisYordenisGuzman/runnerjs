import type { VSCodeTheme } from '../theme.types';

export const gruvboxTheme: VSCodeTheme = {
  name: 'Gruvbox',
  type: 'dark',
  colors: {
    'editor.background': '#282828',
    'editor.foreground': '#ebdbb2',
    'sideBar.background': '#1d2021',
    'sideBar.foreground': '#ebdbb2',
    'titleBar.activeBackground': '#1d2021',
    'focusBorder': '#458588',
    'activityBarBadge.background': '#fb4934',
    'button.background': '#458588'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#928374', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#b8bb26' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#d3869b' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#ebdbb2' } },
    { scope: ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], settings: { foreground: '#fb4934' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#b8bb26' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#fabd2f' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#fb4934' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#fabd2f' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#ebdbb2' } },
    { scope: ['variable.parameter'], settings: { foreground: '#83a598', fontStyle: 'italic' } }
  ]
};
