import type { VSCodeTheme } from '../theme.types';


export const oneDarkTheme: VSCodeTheme = {
  name: 'One Dark',
  type: 'dark',
  colors: {
    'editor.background': '#282c34',
    'editor.foreground': '#abb2bf',
    'sideBar.background': '#21252b',
    'sideBar.foreground': '#abb2bf',
    'titleBar.activeBackground': '#21252b',
    'focusBorder': '#528bff',
    'activityBarBadge.background': '#528bff',
    'button.background': '#3e4451'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#5c6370', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string', 'string.template', 'punctuation.definition.string.template'], settings: { foreground: '#98c379' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#d19a66' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object', 'variable.other.property'], settings: { foreground: '#e06c75' } },
    { scope: ['keyword', 'keyword.control', 'keyword.operator.new', 'storage.type', 'storage.modifier', 'keyword.operator.expression'], settings: { foreground: '#c678dd' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function', 'entity.name.method'], settings: { foreground: '#61afef' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#e5c07b' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag', 'meta.tag.sgml'], settings: { foreground: '#e06c75' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#d19a66' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator', 'punctuation.section.embedded'], settings: { foreground: '#abb2bf' } },
    { scope: ['variable.parameter'], settings: { foreground: '#d19a66', fontStyle: 'italic' } }
  ]

};
