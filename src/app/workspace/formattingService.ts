/**
 * Formatting service using Prettier standalone (browser-safe, no Node.js required).
 * Maps AppSettings['formatting'] to Prettier options.
 */
import type { AppSettings } from '../../shared/ipc';

// Lazy-load prettier to avoid bundling it upfront
let prettierModule: typeof import('prettier/standalone') | null = null;
let babelPlugin: unknown = null;
let typescriptPlugin: unknown = null;
let estreePlugin: unknown = null;

async function loadPrettier() {
  if (prettierModule) return;
  const [prettier, babel, typescript, estree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/typescript'),
    import('prettier/plugins/estree'),
  ]);
  prettierModule = prettier;
  babelPlugin = babel.default ?? babel;
  typescriptPlugin = typescript.default ?? typescript;
  estreePlugin = estree.default ?? estree;
}

type PrettierParser = 'babel' | 'babel-ts' | 'typescript';

export async function formatCode(
  code: string,
  formattingSettings: AppSettings['formatting'],
  language: 'javascript' | 'typescript' = 'javascript'
): Promise<string> {
  await loadPrettier();
  if (!prettierModule) throw new Error('Prettier failed to load');

  const parser: PrettierParser = language === 'typescript' ? 'babel-ts' : 'babel';

  const plugins = [babelPlugin, estreePlugin, typescriptPlugin];

  const formatted = await prettierModule.format(code, {
    parser,
    plugins: plugins as import('prettier').Plugin[],
    // Map AppSettings.formatting -> Prettier options
    printWidth: formattingSettings.printWidth,
    tabWidth: formattingSettings.tabWidth,
    semi: formattingSettings.semicolons,
    singleQuote: formattingSettings.singleQuotes,
    // 'always' is not a valid Prettier quoteProps; map it to 'consistent'
    quoteProps: formattingSettings.quoteProps === 'always' ? 'consistent' : formattingSettings.quoteProps,
    jsxSingleQuote: formattingSettings.jsxQuotes,
    trailingComma: formattingSettings.trailingCommas,
    bracketSpacing: formattingSettings.bracketSpacing,
    arrowParens: formattingSettings.arrowFunctionParentheses,
  });

  return formatted;
}
