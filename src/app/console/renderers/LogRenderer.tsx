import type { RendererProps } from './types';
import { ValueRenderer } from './ValueRenderer';
import { TableRenderer } from './TableRenderer';
import { ErrorRenderer } from './ErrorRenderer';

export const LogRenderer = ({ log, highlighting = true }: RendererProps) => {
  if (log.type === 'table') {
    return <TableRenderer log={log} highlighting={highlighting} />;
  }

  if (log.type === 'error' && !log.isPlain) {
    return <ErrorRenderer log={log} highlighting={highlighting} />;
  }

  if (log.type === 'group' || log.type === 'groupCollapsed') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontWeight: 'bold' }}>
        {log.value.map((val, i) => (
          <ValueRenderer key={i} value={val} highlighting={highlighting} />
        ))}
      </div>
    );
  }

  if (log.type === 'groupEnd') {
    return null; // Handled by structural logic if implemented, otherwise ignored
  }

  // Fallback for standard logs (log, info, warn, debug, dir, timeEnd)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {log.value.map((val, i) => (
        <ValueRenderer 
          key={i} 
          value={val} 
          highlighting={highlighting} 
          isCaptured={log.isCaptured}
          isError={log.type === 'error'}
        />
      ))}
    </div>
  );
};
