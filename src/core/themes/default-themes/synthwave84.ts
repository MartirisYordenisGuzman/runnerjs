import type { VSCodeTheme } from '../theme.types';


export const synthwave84Theme: VSCodeTheme = {
  name: "SynthWave '84",
  type: 'dark',
  colors: {
    'editor.background': '#262335',
    'editor.foreground': '#ffffff',
    'sideBar.background': '#241b2f',
    'sideBar.foreground': '#ffffff',
    'titleBar.activeBackground': '#241b2f',
    'focusBorder': '#f97e72',
    'activityBarBadge.background': '#f97e72',
    'button.background': '#614d85'
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#848bb2', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string', 'string.template'], settings: { foreground: '#fffe3e' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], settings: { foreground: '#f97e72' } },
    { scope: ['variable.language.this', 'variable.other.readwrite', 'variable.other.object'], settings: { foreground: '#ffffff' } },
    { scope: ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], settings: { foreground: '#ff7edb' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#36f9f6' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'], settings: { foreground: '#fede5d', fontStyle: 'italic' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#f97e72' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#36f9f6' } },
    { scope: ['punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'keyword.operator'], settings: { foreground: '#fede5d' } },
    { scope: ['variable.parameter'], settings: { foreground: '#fe4450', fontStyle: 'italic' } }
  ]

};
