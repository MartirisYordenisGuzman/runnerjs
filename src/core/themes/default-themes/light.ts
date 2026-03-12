import type { VSCodeTheme } from '../theme.types';


export const lightTheme: VSCodeTheme = {
  name: 'Light',
  type: 'light',
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#333333',
    'sideBar.background': '#f3f3f3',
    'sideBar.foreground': '#333333',
    'titleBar.activeBackground': '#dddddd',
    'focusBorder': '#007acc',
    'activityBarBadge.background': '#007acc',
    'button.background': '#007acc'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#008000', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#a31515' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#098658' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#001080' } },
    { scope: ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], settings: { foreground: '#0000ff' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#745a00' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#267f99' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#800000' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#ff0000' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#000000' } },
    { scope: ['variable.parameter'], settings: { foreground: '#001080', fontStyle: 'italic' } }
  ]

};
