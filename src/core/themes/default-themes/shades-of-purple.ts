import type { VSCodeTheme } from '../theme.types';


export const shadesOfPurpleTheme: VSCodeTheme = {
  name: 'Shades of Purple',
  type: 'dark',
  colors: {
    'editor.background': '#2d2b55',
    'editor.foreground': '#ffffff',
    'sideBar.background': '#1e1e3f',
    'sideBar.foreground': '#ffffff',
    'titleBar.activeBackground': '#1e1e3f',
    'focusBorder': '#fad000',
    'activityBarBadge.background': '#fad000',
    'button.background': '#4d21fc'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#b362ff', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string', 'string.template'], settings: { foreground: '#a5ff90' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#ff628c' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#ffffff' } },
    { scope: ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], settings: { foreground: '#ff9d00' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#fad000' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#ff9d00', fontStyle: 'italic' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#ff9d00' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#fad000' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#ff9d00' } },
    { scope: ['variable.parameter'], settings: { foreground: '#9effff', fontStyle: 'italic' } }
  ]

};
