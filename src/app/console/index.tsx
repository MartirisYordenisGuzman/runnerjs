import { useEffect, useRef, useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { ConsoleLogMessage } from '../../shared/ipc';

interface ConsolePanelProps {
  logs: ConsoleLogMessage[];
  executionTime?: number;
  scrolling?: 'None' | 'Automatic';
  isVertical?: boolean;
  highlighting?: boolean;
  matchLines?: boolean;
  lineHeight?: number;
  fontSize?: number;
  showConsoleHeader?: boolean;
  onExplain?: () => void;
}

const ConsoleValue = ({ 
  value, 
  highlighting = true, 
  isError = false,
  isCaptured = false
}: { 
  value: unknown, 
  highlighting?: boolean, 
  isError?: boolean,
  isCaptured?: boolean
}) => {
  // Handle new { type, value } protocol
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
      return <span style={{ color: 'var(--text-primary)', fontWeight: isError ? 'bold' : 'normal' }}>{strValue}</span>;
    }

    // Use yellow color and ALWAYS use quotes as requested by user
    return <span style={{ color: highlighting ? '#e6db74' : 'inherit' }}>"{strValue}"</span>;
  }
  
  if (itemType === 'number') {
    return <span style={{ color: highlighting ? '#ae81ff' : 'inherit' }}>{String(itemValue)}</span>;
  }
  
  if (itemType === 'boolean') {
    return <span style={{ color: highlighting ? '#f92672' : 'inherit' }}>{String(itemValue)}</span>;
  }

  if (itemType === 'array' && Array.isArray(itemValue)) {
    const bracketColor = highlighting ? '#66d9ef' : 'inherit';
    return (
      <span style={{ color: 'inherit' }}>
        <span style={{ color: bracketColor }}>[</span>
        {itemValue.length > 0 && <span> </span>}
        {itemValue.map((v, i) => (
          <span key={i}>
            <ConsoleValue value={v} highlighting={highlighting} isCaptured={isCaptured} />
            {i < itemValue.length - 1 && <span style={{ color: 'inherit' }}>, </span>}
          </span>
        ))}
        {itemValue.length > 0 && <span> </span>}
        <span style={{ color: bracketColor }}>]</span>
      </span>
    );
  }

  if (itemType === 'object' && typeof itemValue === 'object' && itemValue !== null) {
    const braceColor = highlighting ? '#66d9ef' : 'inherit';
    const entries = Object.entries(itemValue as Record<string, unknown>);
    
    if (entries.length === 0) {
      return <span style={{ color: braceColor }}>{'{ }'}</span>;
    }

    return (
      <span style={{ color: 'inherit' }}>
        <span style={{ color: braceColor }}>{'{'}</span>
        {' '}
        {entries.map(([key, val], i) => (
          <span key={key}>
            <span style={{ color: highlighting ? '#66d9ef' : 'inherit' }}>{key}</span>
            <span style={{ color: 'inherit' }}>: </span>
            <ConsoleValue value={val} highlighting={highlighting} isCaptured={isCaptured} />
            {i < entries.length - 1 && <span style={{ color: 'inherit' }}>, </span>}
          </span>
        ))}
        {' '}
        <span style={{ color: braceColor }}>{'}'}</span>
      </span>
    );
  }

  if (itemType === 'serialized' || itemType === 'object') {
     return <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{String(itemValue)}</span>;
  }
  
  return <span>{String(itemValue)}</span>;
};

export function ConsolePanel({ 
  logs, 
  executionTime, 
  scrolling, 
  highlighting = true, 
  matchLines, 
  lineHeight,
  fontSize = 14,
  showConsoleHeader = true,
  onExplain
}: ConsolePanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (scrolling === 'Automatic') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, scrolling]);

  // Group logs by line number when matchLines is active to prevent overlapping
  const processedLogs = useMemo(() => {
    if (!matchLines) return logs;
    
    const result: ConsoleLogMessage[] = [];
    const lineMap = new Map<number, ConsoleLogMessage>();
    
    logs.forEach(log => {
      // Ensure value is an array to avoid splitting strings into characters
      const values = Array.isArray(log.value) ? log.value : [log.value];
      
      // We only group logs that have a line number
      if (log.line) {
        if (lineMap.has(log.line)) {
          const existing = lineMap.get(log.line)!;
          // Append new values to the existing line group
          existing.value = [...existing.value, ...values];
        } else {
          // Create a shallow clone to avoid mutating original logs
          const groupedLog = { ...log, value: [...values] };
          lineMap.set(log.line, groupedLog);
          result.push(groupedLog);
        }
      } else {
        // Logs without line numbers (like global errors) are kept separate
        result.push(log);
      }
    });
    
    return result;
  }, [logs, matchLines]);

  const finalLineHeight = lineHeight || 19; // Match Monaco's default line height

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        height: '100%', 
      overflowY: 'auto', 
      paddingTop: matchLines ? '16px' : '20px', 
      paddingBottom: '20px',
      paddingLeft: matchLines ? '10px' : '20px',
      paddingRight: matchLines ? '0' : '20px',
      boxSizing: 'border-box', 
      backgroundColor: 'var(--bg-secondary)', 
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)', 
      fontSize: `${fontSize}px`,
      lineHeight: `${finalLineHeight}px`,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden'
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        flexWrap: 'nowrap', 
        gap: matchLines ? '0' : '4px',
        alignItems: 'flex-start',
        position: 'relative',
        flex: 1,
        width: '100%',
        minHeight: matchLines ? `${processedLogs.length * finalLineHeight + 100}px` : 'auto',
        paddingLeft: matchLines ? '16px' : '0',
        overflowX: 'hidden'
      }}>
        {processedLogs.length === 0 && !matchLines && (
           <div style={{ color: 'var(--border-highlight)', fontStyle: 'italic', marginTop: '8px', width: '100%', padding: '0 20px' }}>Waiting for execution...</div>
        )}

        {/* Explain Output Button */}
        {onExplain && processedLogs.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExplain();
            }}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'var(--bg-toolbar)',
              color: 'var(--accent-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 100,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease-in-out',
              opacity: isHovered ? 1 : 0.3 // Pulsing or subtle visibility when an error exists
            }}
            title="Explain Output"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-toolbar)';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.opacity = isHovered ? '1' : '0.3';
            }}
          >
            <Sparkles size={16} />
          </button>
        )}
        {processedLogs.map((log, k) => {
          let color = 'var(--text-primary)';
          let badgeBg = 'transparent';
          let badgeText = '';
          const isStandardLog = log.type === 'log';
          const isCaptured = log.isCaptured;
          const isError = log.type === 'error';
          
          if (log.type === 'warn') { color = 'var(--color-warn)'; badgeBg = 'rgba(234, 179, 8, 0.1)'; badgeText = 'WARN'; }
          if (log.type === 'error') { 
            // RunJS style: Light text, no badge, no background
            color = 'var(--text-primary)'; 
            badgeBg = 'transparent'; 
            badgeText = ''; 
          }
          if (log.type === 'info') { color = 'var(--color-info)'; badgeBg = 'rgba(59, 130, 246, 0.1)'; badgeText = 'INFO'; }
          if (log.type === 'log') { color = isCaptured ? 'var(--text-muted)' : 'var(--color-log)'; }

          const topOffset = matchLines && log.line ? ((log.line - 1) * finalLineHeight) : undefined;

          return (
            <div key={k} className={`log-entry ${log.type}`} style={{ 
              color: highlighting ? color : 'var(--text-primary)', 
              padding: (isStandardLog || isError) ? '0px 0' : '6px 10px',
              backgroundColor: (isStandardLog || isError) ? 'transparent' : badgeBg,
              borderRadius: '6px',
              borderLeft: (!isStandardLog && !isError) ? `3px solid ${color}` : 'none',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              width: matchLines ? (isCaptured ? 'auto' : 'calc(100% - 40px)') : '100%',
              maxWidth: '100%',
              flexShrink: 0,
              position: matchLines && log.line ? 'absolute' : 'relative',
              top: topOffset !== undefined ? `${topOffset}px` : 'auto',
              opacity: isCaptured ? 0.8 : 1,
              fontStyle: isCaptured ? 'italic' : 'normal',
              minHeight: `${finalLineHeight}px`,
              lineHeight: `${finalLineHeight}px`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'normal',
              overflow: 'visible',
              marginBottom: isError ? '12px' : '0'
            }}>
              {badgeText !== '' && (
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: 'bold', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  backgroundColor: color,
                  color: '#000',
                  marginTop: '0px',
                  flexShrink: 0
                }}>
                  {badgeText}
                </span>
              )}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'row', 
                flexWrap: 'wrap',
                gap: isCaptured ? '6px' : '8px', 
                overflow: 'visible',
                flex: 1,
                alignItems: 'baseline',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                wordBreak: 'normal'
              }}>
                {log.value.map((val, m) => (
                  <div key={m} style={{ display: 'inline-block', whiteSpace: 'pre-wrap', flexShrink: 0 }}>
                    <ConsoleValue 
                      value={val} 
                      highlighting={highlighting} 
                      isError={isError} 
                      isCaptured={isCaptured} 
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showConsoleHeader && (
        <div style={{ 
          color: 'var(--text-muted)',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '8px',
          margin: '16px 20px 0 20px',
          flexShrink: 0,
          height: '24px'
        }}>
          <span>Console Output</span>
          {executionTime !== undefined && <span>{executionTime}ms</span>}
        </div>
      )}
      <div ref={bottomRef} style={{ height: '4px', width: '100%' }} />
    </div>
  );
}
