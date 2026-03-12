import type { VSCodeTheme } from '../theme.types';

export const nordTheme: VSCodeTheme = {
  name: 'Nord',
  type: 'dark',
  colors: {
    'editor.background': '#2e3440',
    'editor.foreground': '#d8dee9',
    'sideBar.background': '#2e3440',
    'sideBar.foreground': '#d8dee9',
    'titleBar.activeBackground': '#2e3440',
    'focusBorder': '#434c5e',
    'activityBarBadge.background': '#88c0d0',
    'button.background': '#434c5e'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#4c566a', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#a3be8c' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#b48ead' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#d8dee9' } },
    { scope: ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], settings: { foreground: '#81a1c1' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#88c0d0' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#8fbcbb' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#81a1c1' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#8fbcbb' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#81a1c1' } },
    { scope: ['variable.parameter'], settings: { foreground: '#d8dee9' } }
  ]
};
