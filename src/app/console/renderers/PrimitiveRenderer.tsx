import type { ValueRendererProps } from './types';

export const PrimitiveRenderer = ({ value, highlighting, isError }: ValueRendererProps) => {
  const itemType = (value && typeof value === 'object' && 'type' in value) ? (value as { type: string }).type : typeof value;
  const itemValue = (value && typeof value === 'object' && 'value' in value) ? (value as { value: unknown }).value : value;

  if (itemValue === null || itemType === 'null') return <span style={{ color: highlighting ? '#f92672' : 'inherit' }}>null</span>;
  if (itemValue === undefined || itemType === 'undefined') return <span style={{ color: highlighting ? '#f92672' : 'inherit' }}>undefined</span>;
  if (itemValue === '=>') return <span style={{ color: highlighting ? '#ae81ff' : 'inherit', opacity: 0.7 }}>⇒</span>;
  
  if (itemType === 'string') {
    const strValue = String(itemValue);
    const isCodeFrame = strValue.includes('|') && (strValue.includes('>') || strValue.includes('^'));
    
    if (isError || isCodeFrame) {
      if (isCodeFrame) {
        const lines = strValue.split('\n');
        return (
          <div style={{ color: 'var(--text-primary)', width: '100%' }}>
            {lines.map((line, i) => {
              const lineMatch = line.match(/^(\s*>|\s*)(\s*\d+\s*\||^\s*\|)(.*)$/);
              if (lineMatch) {
                const [, marker, lineNumber, rest] = lineMatch;
                return (
                  <div key={i} style={{ display: 'flex', gap: '0' }}>
                    <span style={{ color: '#ae81ff', whiteSpace: 'pre', flexShrink: 0 }}>{marker}{lineNumber}</span>
                    <span style={{ whiteSpace: 'pre-wrap', flexShrink: 1 }}>{rest}</span>
                  </div>
                );
              }
              return <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{line}</div>;
            })}
          </div>
        );
      }
      return <span style={{ color: 'var(--text-primary)' }}>{strValue}</span>;
    }

    return <span style={{ color: highlighting ? '#e6db74' : 'inherit' }}>"{strValue}"</span>;
  }
  
  if (itemType === 'number') {
    return <span style={{ color: highlighting ? '#ae81ff' : 'inherit' }}>{String(itemValue)}</span>;
  }
  
  if (itemType === 'boolean') {
    return <span style={{ color: highlighting ? '#f92672' : 'inherit' }}>{String(itemValue)}</span>;
  }

  if (itemType === 'serialized') {
    return <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{String(itemValue)}</span>;
  }
  
  return <span>{String(itemValue)}</span>;
};
