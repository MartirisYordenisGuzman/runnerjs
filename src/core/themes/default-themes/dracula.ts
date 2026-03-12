import type { VSCodeTheme } from '../theme.types';


export const draculaTheme: VSCodeTheme = {
  name: 'Dracula',
  type: 'dark',
  colors: {
    'editor.background': '#282a36',
    'editor.foreground': '#f8f8f2',
    'sideBar.background': '#21222c',
    'sideBar.foreground': '#f8f8f2',
    'titleBar.activeBackground': '#21222c',
    'focusBorder': '#6272a4',
    'activityBarBadge.background': '#ff79c6',
    'button.background': '#44475a'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6272a4' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#f1fa8c' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#bd93f9' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#f8f8f2' } },
    { scope: ['keyword', 'keyword.control', 'keyword.operator.new', 'storage.type', 'storage.modifier'], settings: { foreground: '#ff79c6' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#50fa7b' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#8be9fd', fontStyle: 'italic' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#ff79c6' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#50fa7b' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#ff79c6' } },
    { scope: ['variable.parameter'], settings: { foreground: '#ffb86c', fontStyle: 'italic' } }
  ]

};
