import type { VSCodeTheme } from '../theme.types';


export const monokaiTheme: VSCodeTheme = {
  name: 'Monokai',
  type: 'dark',
  colors: {
    'editor.background': '#272822',
    'editor.foreground': '#f8f8f2',
    'sideBar.background': '#1e1f1c',
    'sideBar.foreground': '#f8f8f2',
    'titleBar.activeBackground': '#1e1f1c',
    'focusBorder': '#ae81ff',
    'activityBarBadge.background': '#f92672',
    'button.background': '#75715e'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#88846f', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string', 'string.template', 'punctuation.definition.string.template'], settings: { foreground: '#e6db74' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#ae81ff' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object', 'variable.other.property'], settings: { foreground: '#f8f8f2' } },
    { scope: ['keyword', 'keyword.control', 'keyword.operator.new', 'storage.type', 'storage.modifier', 'keyword.operator.expression'], settings: { foreground: '#f92672' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function', 'entity.name.method'], settings: { foreground: '#a6e22e' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#66d9ef', fontStyle: 'italic' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#f92672' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#a6e22e' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#f8f8f2' } },
    { scope: ['variable.parameter'], settings: { foreground: '#fd971f', fontStyle: 'italic' } }
  ]

};
