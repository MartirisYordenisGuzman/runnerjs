import { useLayoutEffect, useRef } from 'react';
import type { ConsoleLogMessage } from '../../../shared/ipc';
import { LogRenderer } from './LogRenderer';
import { getLogColor, getLogBadge, getBadgeBg } from './helpers';

interface ConsoleLineProps {
  log: ConsoleLogMessage;
  matchLines: boolean;
  lineHeight: number;
  highlighting: boolean;
  groupDepth: number;
  topOffset?: number;
  onMeasure?: (id: string, lines: number) => void;
}

export const ConsoleLine = ({
  log,
  matchLines,
  lineHeight,
  highlighting,
  groupDepth,
  topOffset,
  onMeasure
}: ConsoleLineProps) => {
  const elementRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!matchLines || !onMeasure || !elementRef.current) return;

    const measure = () => {
      if (!elementRef.current) return;
      const height = elementRef.current.offsetHeight;
      const lines = Math.max(1, Math.round(height / lineHeight));
      onMeasure(log.id, lines);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(elementRef.current);
    
    return () => observer.disconnect();
  }, [matchLines, onMeasure, log.id, lineHeight]);

  const isError = log.type === 'error';
  const isCaptured = log.isCaptured;
  const color = getLogColor(log.type, isCaptured);
  const badgeText = getLogBadge(log.type);
  const badgeBg = getBadgeBg(log.type);
  const isStandardLog = log.type === 'log' || log.type === 'info' || log.type === 'debug' || log.type === 'warn';

  return (
    <div 
      ref={elementRef}
      className={`log-entry ${log.type}`} 
      style={{ 
        color: highlighting ? color : 'var(--text-primary)', 
        padding: matchLines ? '0' : ((isStandardLog || isError) ? '0' : '2px 10px'),
        backgroundColor: (isStandardLog || isError) ? 'transparent' : badgeBg,
        borderRadius: '6px',
        borderLeft: (!isStandardLog && !isError && log.type !== 'table' && log.type !== 'group' && log.type !== 'groupCollapsed') ? `3px solid ${color}` : 'none',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '4px',
        alignItems: 'flex-start',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        flexShrink: 0,
        position: (matchLines && log.line) ? 'absolute' : 'relative',
        top: topOffset !== undefined ? `${topOffset}px` : 'auto',
        opacity: isCaptured ? 0.8 : 1,
        fontStyle: isCaptured ? 'italic' : 'normal',
        fontWeight: (log.type === 'group' || log.type === 'groupCollapsed') ? 'bold' : 'normal',
        minHeight: `${lineHeight}px`,
        lineHeight: `${lineHeight}px`,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'visible',
        marginBottom: isError ? '12px' : '0',
        marginLeft: matchLines ? 0 : `${groupDepth * 20}px`,
        paddingLeft: ((log.type === 'group' || log.type === 'groupCollapsed') && !matchLines) ? '0' : undefined
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', width: '100%' }}>
        {badgeText !== '' && (
          <span style={{ 
            fontSize: '10px', 
            fontWeight: 'bold', 
            padding: '2px 6px', 
            borderRadius: '4px',
            backgroundColor: color,
            color: '#000',
            marginTop: '0px',
            flexShrink: 0,
            lineHeight: '1',
            display: 'inline-block'
          }}>
            {badgeText}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <LogRenderer log={log} highlighting={highlighting} />
        </div>
      </div>
    </div>
  );
};
