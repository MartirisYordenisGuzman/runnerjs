import type { VSCodeTheme } from '../theme.types';

export const palenightTheme: VSCodeTheme = {
  name: 'Palenight',
  type: 'dark',
  colors: {
    'editor.background': '#292d3e',
    'editor.foreground': '#a6accd',
    'sideBar.background': '#292d3e',
    'sideBar.foreground': '#a6accd',
    'titleBar.activeBackground': '#292d3e',
    'focusBorder': '#717cb4',
    'activityBarBadge.background': '#82aaff',
    'button.background': '#717cb4'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#676e95', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#c3e88d' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#f78c6c' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#a6accd' } },
    { scope: ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], settings: { foreground: '#c792ea' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#82aaff' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#ffcb6b' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#f07178' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#c792ea' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#89ddff' } },
    { scope: ['variable.parameter'], settings: { foreground: '#f07178', fontStyle: 'italic' } }
  ]
};
