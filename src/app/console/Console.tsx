import { useRef, useEffect, useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { ConsoleLogMessage } from '../../shared/ipc';
import { ConsoleLine } from './renderers/ConsoleLine';

export interface ConsolePanelProps {
  logs: ConsoleLogMessage[];
  executionTime?: number;
  scrolling?: 'Automatic' | 'None';
  highlighting?: boolean;
  matchLines?: boolean;
  lineHeight?: number;
  fontSize?: number;

  onExplain?: () => void;
}

export const ConsolePanel = ({ 
  logs, 
  scrolling, 
  highlighting = true, 
  matchLines,
  lineHeight,
  fontSize = 14,
  onExplain
}: ConsolePanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const finalLineHeight = lineHeight || fontSize * 1.5;

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
      const values = Array.isArray(log.value) ? log.value : [log.value];
      
      if (log.line) {
        if (lineMap.has(log.line)) {
          const existing = lineMap.get(log.line)!;
          existing.value = [...existing.value, ...values];
        } else {
          const groupedLog = { ...log, value: [...values] };
          lineMap.set(log.line, groupedLog);
          result.push(groupedLog);
        }
      } else {
        result.push(log);
      }
    });
    
    return result;
  }, [logs, matchLines]);

  // Calculate depths for grouped logs
  let currentGroupDepth = 0;

  return (
    <div 
      className="console-panel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        backgroundColor: 'transparent',
        fontFamily: 'var(--font-mono)',
        fontSize: `${fontSize}px`,
        color: 'var(--text-primary)',
        overflowY: 'auto',
        position: 'relative'
      }}
    >
      <div 
        className="console-output"
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '0', 
          alignItems: 'flex-start',
          position: 'relative',
          flex: 1,
          width: '100%',
          minHeight: matchLines ? `${processedLogs.reduce((max, log) => Math.max(max, log.line || 0), 0) * finalLineHeight + 100}px` : 'auto',
          overflowX: 'hidden'
        }}
      >
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
              opacity: isHovered ? 1 : 0.3
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
          const myDepth = currentGroupDepth;
          if (log.type === 'group' || log.type === 'groupCollapsed') currentGroupDepth++;
          if (log.type === 'groupEnd') {
            currentGroupDepth = Math.max(0, currentGroupDepth - 1);
            return null;
          }

          return (
            <ConsoleLine 
              key={k}
              log={log}
              matchLines={!!matchLines}
              lineHeight={finalLineHeight}
              highlighting={highlighting}
              groupDepth={myDepth}
            />
          );
        })}
        <div ref={bottomRef} style={{ height: '30px', flexShrink: 0 }} />
      </div>
    </div>
  );
};
