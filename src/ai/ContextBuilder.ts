import { AIContext, ChatMessage } from './types';

export class ContextBuilder {
  private static readonly MAX_CODE_LENGTH = 20000;
  private static readonly MAX_CONSOLE_LENGTH = 5000;
  private static readonly MAX_FILES = 10;
  private static readonly MAX_FILE_CONTENT = 2000;

  static buildSystemPrompt(context: AIContext): ChatMessage[] {
    const sections: string[] = [];

    sections.push(`You are an expert JavaScript runtime assistant inside an interactive playground similar to RunJS.

You help users:
• understand code
• debug errors
• explain console output
• generate code
• improve performance`);

    sections.push('RUNTIME CONTEXT\n===============');

    // Editor Code
    if (context.currentCode) {
      const code = this.truncate(context.currentCode, this.MAX_CODE_LENGTH);
      sections.push(`EDITOR CODE\n-----------\n\`\`\`javascript\n${code}\n\`\`\``);
    }

    // Console Output
    if (context.consoleOutput) {
      const console = this.truncate(context.consoleOutput, this.MAX_CONSOLE_LENGTH);
      sections.push(`CONSOLE OUTPUT\n--------------\n${console}`);
    }

    // Runtime Errors
    if (context.runtimeError) {
      sections.push(`RUNTIME ERRORS\n--------------\n${context.runtimeError}`);
    }

    // Open Files
    if (context.openFiles && context.openFiles.length > 0) {
      let filesContent = 'OPEN FILES\n----------\n';
      context.openFiles.slice(0, this.MAX_FILES).forEach(file => {
        const content = this.truncate(file.content, this.MAX_FILE_CONTENT);
        filesContent += `File: ${file.name}\n\`\`\`\n${content}\n\`\`\`\n\n`;
      });
      sections.push(filesContent.trim());
    }

    return [{
      role: 'system',
      content: sections.join('\n\n')
    }];
  }

  private static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '\n... [TRUNCATED]';
  }
}
