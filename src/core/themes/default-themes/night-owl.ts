import type { VSCodeTheme } from '../theme.types';

export const nightOwlTheme: VSCodeTheme = {
  name: 'Night Owl',
  type: 'dark',
  colors: {
    'editor.background': '#011627',
    'editor.foreground': '#d6deeb',
    'sideBar.background': '#010e17',
    'sideBar.foreground': '#d6deeb',
    'titleBar.activeBackground': '#010e17',
    'focusBorder': '#5f7e97',
    'activityBarBadge.background': '#82aaff',
    'button.background': '#7e57c2'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#637777', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string', 'string.template'], settings: { foreground: '#ecc48d' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#f78c6c' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#d6deeb' } },
    { scope: ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], settings: { foreground: '#c792ea' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#82aaff' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#addb67', fontStyle: 'italic' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#7fdbca' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#addb67' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#c792ea' } },
    { scope: ['variable.parameter'], settings: { foreground: '#d7dbe0', fontStyle: 'italic' } }
  ]
};
