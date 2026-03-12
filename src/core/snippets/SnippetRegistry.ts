import type { Snippet } from '../../shared/ipc';

let completionProviderDisposables: any[] = [];
let lastMonacoInstance: any = null;
let lastSnippets: Snippet[] = [];

/**
 * Registers custom snippets as Monaco completion items.
 * Clears previous registrations to avoid duplicates.
 */
export function registerSnippetSuggestions(monaco: any, snippets: Snippet[] | null) {
  if (monaco) lastMonacoInstance = monaco;
  if (snippets) lastSnippets = snippets;

  const m = lastMonacoInstance;
  const s = lastSnippets;

  if (!m || !s) return;

  // Dispose previous providers
  completionProviderDisposables.forEach(d => d.dispose());
  completionProviderDisposables = [];

  const languages = ['javascript', 'typescript'];

  languages.forEach(lang => {
    const disposable = m.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions = s.map((snip: Snippet) => ({
          label: snip.name,
          kind: m.languages.CompletionItemKind.Snippet,
          insertText: snip.code,
          insertTextRules: m.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: snip.description || `Custom snippet: ${snip.name}`,
          detail: 'Snippet',
          range: range,
          sortText: `00-${snip.name}`
        }));

        return { suggestions };
      }
    });
    completionProviderDisposables.push(disposable);
  });
}
