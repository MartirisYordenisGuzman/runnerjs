import type { RendererProps } from './types';
import { TableRenderer } from './TableRenderer';
import { ErrorRenderer } from './ErrorRenderer';
import { inspect } from './inspect';

const Colors = {
  string: '#e6db74',
  number: '#ae81ff',
  boolean: '#ae81ff',
  null: '#ae81ff',
  undefined: '#ae81ff',
  key: '#f92672',
  punctuation: '#f8f8f2',
  comment: '#75715e',
  class: '#66d9ef',
  whitespace: 'inherit'
};

export const LogRenderer = ({ log, highlighting = true }: RendererProps) => {
  if (log.type === 'table') {
    return <TableRenderer log={log} highlighting={highlighting} />;
  }

  if (log.type === 'error' && !log.isPlain) {
    return <ErrorRenderer log={log} highlighting={highlighting} />;
  }

  // Handle all logs that aren't tables or direct error alerts
  const isErr = log.type === 'error';
  
  return (
    <div style={{ 
      display: 'inline-block', // Keep arguments on same line but allow internal breaks
      color: isErr ? 'var(--text-error)' : 'var(--text-primary)',
      opacity: log.isCaptured ? 0.8 : 1,
      width: '100%',
      whiteSpace: 'pre'
    }}>
      {log.value.map((val, i) => {
        const tokens = inspect(val);
        return (
          <span key={i} style={{ 
            display: 'inline', 
            marginRight: i < log.value.length - 1 ? '8px' : 0 
          }}>
            {tokens.map((token, j) => (
              <span 
                key={j} 
                style={{ 
                  color: highlighting ? (Colors[token.type] || 'inherit') : 'inherit',
                  whiteSpace: 'pre'
                }}
              >
                {token.value}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
};

