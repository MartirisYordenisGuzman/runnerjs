import { AlertCircle } from 'lucide-react';
import type { RendererProps } from './types';
import { ValueRenderer } from './ValueRenderer';

export const ErrorRenderer = ({ log, highlighting = true }: RendererProps) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      gap: '4px',
      width: '100%',
      padding: '8px 12px',
      backgroundColor: 'rgba(255, 85, 85, 0.08)',
      borderLeft: '4px solid #ff5555',
      borderRadius: '2px',
      margin: '4px 0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={14} color="#ff5555" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {log.value.map((val, i) => (
            <ValueRenderer 
              key={i} 
              value={val} 
              highlighting={highlighting} 
              isError={true} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};
