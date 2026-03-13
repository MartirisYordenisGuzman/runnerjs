import type { SerializedValue } from './types';

export interface Token {
  type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'key' | 'punctuation' | 'comment' | 'class' | 'whitespace';
  value: string;
}

export function inspect(value: SerializedValue | unknown, depth = 0, indentSize = 2): Token[] {
  const tokens: Token[] = [];

  function getIndent(d: number): string {
    return ' '.repeat(d * indentSize);
  }

  function format(val: unknown, d: number, compact = false): void {
    const isObj = val && typeof val === 'object';
    const sVal = isObj ? (val as SerializedValue) : null;

    if (val === null || (sVal && sVal.type === 'null')) {
      tokens.push({ type: 'null', value: 'null' });
      return;
    }
    if (val === undefined || (sVal && sVal.type === 'undefined')) {
      tokens.push({ type: 'undefined', value: 'undefined' });
      return;
    }

    // Support serialized objects from our runner
    const type = sVal ? sVal.type : typeof val;
    const actualValue = sVal ? sVal.value : val;

    switch (type) {
      case 'string': {
        tokens.push({ type: 'string', value: `"${actualValue}"` });
        break;
      }
      case 'number':
        tokens.push({ type: 'number', value: String(actualValue) });
        break;
      case 'boolean':
        tokens.push({ type: 'boolean', value: String(actualValue) });
        break;
      case 'function':
        tokens.push({ type: 'punctuation', value: '[Function: ' });
        tokens.push({ type: 'class', value: (actualValue as string) || '(anonymous)' });
        tokens.push({ type: 'punctuation', value: ']' });
        break;
      case 'date':
        tokens.push({ type: 'punctuation', value: 'Date(' });
        tokens.push({ type: 'string', value: `'${actualValue}'` });
        tokens.push({ type: 'punctuation', value: ')' });
        break;
      case 'promise':
        tokens.push({ type: 'punctuation', value: 'Promise { ' });
        tokens.push({ type: 'comment', value: '<pending>' });
        tokens.push({ type: 'punctuation', value: ' }' });
        break;
      case 'circular':
        tokens.push({ type: 'comment', value: '[Circular]' });
        break;
      case 'serialized':
        tokens.push({ type: 'comment', value: String(actualValue) });
        break;
      case 'array': {
        const arr = actualValue as unknown[];
        if (arr.length === 0) {
          tokens.push({ type: 'punctuation', value: '[]' });
          break;
        }
        tokens.push({ type: 'punctuation', value: '[ ' });
        arr.forEach((item, i) => {
          format(item, d + 1, true); // Items in array are compact
          if (i < arr.length - 1) {
            tokens.push({ type: 'punctuation', value: ', ' });
          }
        });
        tokens.push({ type: 'punctuation', value: ' ]' });
        break;
      }
      case 'object': {
        const objEntries = Object.entries((actualValue as Record<string, unknown>) || {});
        if (objEntries.length === 0) {
          if ((val as SerializedValue).className) {
            tokens.push({ type: 'class', value: (val as SerializedValue).className! });
            tokens.push({ type: 'punctuation', value: ' ' });
          }
          tokens.push({ type: 'punctuation', value: '{}' });
          break;
        }

        if ((val as SerializedValue).className) {
          tokens.push({ type: 'class', value: (val as SerializedValue).className! });
          tokens.push({ type: 'punctuation', value: ' ' });
        }
        
        if (compact) {
          tokens.push({ type: 'punctuation', value: '{ ' });
          objEntries.forEach(([key, subVal], i) => {
            tokens.push({ type: 'key', value: key });
            tokens.push({ type: 'punctuation', value: ': ' });
            format(subVal, d + 1, true);
            if (i < objEntries.length - 1) {
              tokens.push({ type: 'punctuation', value: ', ' });
            }
          });
          tokens.push({ type: 'punctuation', value: ' }' });
        } else {
          tokens.push({ type: 'punctuation', value: '{\n' });
          objEntries.forEach(([key, subVal]) => {
            tokens.push({ type: 'punctuation', value: getIndent(d + 1) });
            tokens.push({ type: 'key', value: key });
            tokens.push({ type: 'punctuation', value: ': ' });
            format(subVal, d + 1);
            tokens.push({ type: 'punctuation', value: ',\n' });
          });
          tokens.push({ type: 'punctuation', value: getIndent(d) });
          tokens.push({ type: 'punctuation', value: '}' });
        }
        break;
      }
      case 'map': {
        const mapEntries = actualValue as Array<{key: unknown, value: unknown}>;
        const size = (val as SerializedValue).size ?? 0;
        if (mapEntries.length === 0) {
          tokens.push({ type: 'punctuation', value: `Map(${size}) {}` });
          break;
        }
        
        if (compact) {
          tokens.push({ type: 'punctuation', value: `Map(${size}) { ` });
          mapEntries.forEach((entry, i) => {
            format(entry.key, d + 1, true);
            tokens.push({ type: 'punctuation', value: ' => ' });
            format(entry.value, d + 1, true);
            if (i < mapEntries.length - 1) {
              tokens.push({ type: 'punctuation', value: ', ' });
            }
          });
          tokens.push({ type: 'punctuation', value: ' }' });
        } else {
          tokens.push({ type: 'punctuation', value: `Map(${size}) {\n` });
          mapEntries.forEach((entry) => {
            tokens.push({ type: 'punctuation', value: getIndent(d + 1) });
            format(entry.key, d + 1);
            tokens.push({ type: 'punctuation', value: ' => ' });
            format(entry.value, d + 1);
            tokens.push({ type: 'punctuation', value: ',\n' });
          });
          tokens.push({ type: 'punctuation', value: getIndent(d) });
          tokens.push({ type: 'punctuation', value: '}' });
        }
        break;
      }
      case 'set': {
        const setValues = actualValue as unknown[];
        const size = (val as SerializedValue).size ?? 0;
        if (setValues.length === 0) {
          tokens.push({ type: 'punctuation', value: `Set(${size}) {}` });
          break;
        }
        
        if (compact) {
          tokens.push({ type: 'punctuation', value: `Set(${size}) { ` });
          setValues.forEach((item, i) => {
            format(item, d + 1, true);
            if (i < setValues.length - 1) {
              tokens.push({ type: 'punctuation', value: ', ' });
            }
          });
          tokens.push({ type: 'punctuation', value: ' }' });
        } else {
          tokens.push({ type: 'punctuation', value: `Set(${size}) {\n` });
          setValues.forEach((item) => {
            tokens.push({ type: 'punctuation', value: getIndent(d + 1) });
            format(item, d + 1);
            tokens.push({ type: 'punctuation', value: ',\n' });
          });
          tokens.push({ type: 'punctuation', value: getIndent(d) });
          tokens.push({ type: 'punctuation', value: '}' });
        }
        break;
      }
      default:
        tokens.push({ type: 'null', value: String(actualValue) });
    }
  }

  format(value, depth);
  return tokens;
}

