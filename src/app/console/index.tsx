import { useEffect, useRef } from 'react';
import type { ConsoleLogMessage } from '../../shared/ipc';

interface ConsolePanelProps {
  logs: ConsoleLogMessage[];
  executionTime?: number;
  scrolling?: 'None' | 'Automatic';
}

const ConsoleValue = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return <span style={{ color: '#e6db74' }}>'{value}'</span>;
  }
  if (typeof value === 'number') {
    return <span style={{ color: '#ae81ff' }}>{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span style={{ color: '#f92672' }}>{String(value)}</span>;
  }
  if (value === null) return <span style={{ color: '#f92672' }}>null</span>;
  if (value === undefined) return <span style={{ color: '#f92672' }}>undefined</span>;
  
  if (Array.isArray(value)) {
    return (
      <span style={{ color: 'var(--text-primary)' }}>
        [{value.map((v, i) => (
          <span key={i}>
            <ConsoleValue value={v} />
            {i < value.length - 1 && ', '}
          </span>
        ))}]
      </span>
    );
  }
  
  if (typeof value === 'object') {
    let stringified = '[Object]';
    try {
      stringified = JSON.stringify(value);
    } catch {
      // ignore
    }
    return <span style={{ color: 'var(--text-primary)' }}>{stringified}</span>;
  }
  
  return <span>{String(value)}</span>;
};

export function ConsolePanel({ logs, executionTime, scrolling }: ConsolePanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrolling === 'Automatic') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, scrolling]);

  return (
    <div style={{ 
      height: '100%', 
      overflowY: 'auto', 
      padding: '20px', 
      boxSizing: 'border-box', 
      backgroundColor: 'var(--bg-secondary)', 
      fontFamily: 'var(--font-mono)', 
      fontSize: '13px',
      lineHeight: '1.6'
    }}>
      <div style={{ 
        marginBottom: '16px', 
        color: 'var(--text-muted)',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '8px'
      }}>
        <span>Console Output</span>
        {executionTime !== undefined && <span>{executionTime}ms</span>}
      </div>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: '4px 12px',
        alignItems: 'flex-start'
      }}>
        {logs.length === 0 && (
           <div style={{ color: 'var(--border-highlight)', fontStyle: 'italic', marginTop: '8px', width: '100%' }}>Waiting for execution...</div>
        )}
        {logs.map((log, i) => {
          let color = 'var(--text-primary)';
          let badgeBg = 'transparent';
          let badgeText = '';
          const isStandardLog = log.type === 'log';
          
          if (log.type === 'warn') { color = 'var(--color-warn)'; badgeBg = 'rgba(234, 179, 8, 0.1)'; badgeText = 'WARN'; }
          if (log.type === 'error') { color = 'var(--color-error)'; badgeBg = 'rgba(239, 68, 68, 0.1)'; badgeText = 'ERR'; }
          if (log.type === 'info') { color = 'var(--color-info)'; badgeBg = 'rgba(59, 130, 246, 0.1)'; badgeText = 'INFO'; }
          if (log.type === 'log') { color = 'var(--color-log)'; }

          return (
            <div key={i} className={`log-entry ${log.type}`} style={{ 
              color, 
              padding: isStandardLog ? '2px 0' : '6px 10px',
              backgroundColor: isStandardLog ? 'transparent' : badgeBg,
              borderRadius: '6px',
              borderLeft: !isStandardLog ? `3px solid ${color}` : 'none',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              width: isStandardLog ? 'auto' : '100%',
              flexShrink: 0
            }}>
              {badgeText !== '' && (
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: 'bold', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  backgroundColor: color,
                  color: '#000',
                  marginTop: '2px',
                  flexShrink: 0
                }}>
                  {badgeText}
                </span>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {log.value.map((val, j) => (
                  <ConsoleValue key={j} value={val} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div ref={bottomRef} style={{ height: '4px', width: '100%' }} />
    </div>
  );
}
