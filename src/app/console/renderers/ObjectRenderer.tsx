import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { ValueRendererProps } from './types';
import { ValueRenderer } from './ValueRenderer';

export const ObjectRenderer = ({ 
  value, 
  depth = 0, 
  label, 
  highlighting = true,
  isCaptured = false
}: ValueRendererProps & { depth?: number; label?: string }) => {
  const [isExpanded, setIsExpanded] = useState(depth === 0 && !label);
  const itemType = (value && typeof value === 'object' && 'type' in value) ? (value as { type: string }).type : typeof value;
  const itemValue = (value && typeof value === 'object' && 'value' in value) ? (value as { value: any }).value : value;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const renderLabel = () => {
    if (!label) return null;
    return (
      <span style={{ color: highlighting ? '#66d9ef' : 'inherit', marginRight: '4px' }}>
        {label}:
      </span>
    );
  };

  const renderSummary = () => {
    if (itemType === 'circular') return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>[Circular]</span>;
    if (itemType === 'promise') return <span style={{ color: '#ae81ff' }}>Promise {'{ <pending> }'}</span>;
    if (itemType === 'function') return <span style={{ color: '#66d9ef', fontStyle: 'italic' }}>ƒ {itemValue}()</span>;
    if (itemType === 'date') return <span style={{ color: '#e6db74' }}>Date({itemValue})</span>;

    if (itemType === 'array') {
      return (
        <span style={{ color: 'var(--text-muted)' }}>
          Array({itemValue.length}) {isExpanded ? '' : '[...]'}
        </span>
      );
    }

    if (itemType === 'object') {
      const className = value.className ? `${value.className} ` : '';
      const keys = Object.keys(itemValue || {});
      return (
        <span style={{ color: 'var(--text-muted)' }}>
          {className}{'{'} {isExpanded ? '' : (keys.length > 0 ? '...' : '')} {'}'}
        </span>
      );
    }

    if (itemType === 'map') {
      return <span style={{ color: 'var(--text-muted)' }}>Map({value.size}) {isExpanded ? '' : '{...}'}</span>;
    }

    if (itemType === 'set') {
      return <span style={{ color: 'var(--text-muted)' }}>Set({value.size}) {isExpanded ? '' : '{...}'}</span>;
    }

    return <ValueRenderer value={value} highlighting={highlighting} isCaptured={isCaptured} />;
  };

  const isExpandable = ['object', 'array', 'map', 'set'].includes(itemType) && itemType !== 'circular';

  if (!isExpandable) {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        {renderLabel()}
        {renderSummary()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginLeft: depth > 0 ? '12px' : '0' }}>
      <div 
        onClick={toggle}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer', 
          userSelect: 'none',
          padding: '1px 0'
        }}
      >
        <span style={{ marginRight: '4px', opacity: 0.6, display: 'flex', alignItems: 'center' }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {renderLabel()}
        {renderSummary()}
      </div>
      
      {isExpanded && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          paddingLeft: '4px',
          borderLeft: depth === 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
          marginLeft: '6px'
        }}>
          {itemType === 'array' && (itemValue as any[]).map((val, i) => (
            <ValueRenderer key={i} value={val} depth={depth + 1} label={String(i)} highlighting={highlighting} isCaptured={isCaptured} />
          ))}
          {itemType === 'object' && Object.entries(itemValue || {}).map(([key, val]) => (
            <ValueRenderer key={key} value={val} depth={depth + 1} label={key} highlighting={highlighting} isCaptured={isCaptured} />
          ))}
          {itemType === 'map' && (itemValue as any[]).map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: '4px' }}>
              <ValueRenderer value={entry.key} depth={depth + 1} highlighting={highlighting} isCaptured={isCaptured} />
              <span style={{ opacity: 0.5 }}>→</span>
              <ValueRenderer value={entry.value} depth={depth + 1} highlighting={highlighting} isCaptured={isCaptured} />
            </div>
          ))}
          {itemType === 'set' && (itemValue as any[]).map((val, i) => (
            <ValueRenderer key={i} value={val} depth={depth + 1} highlighting={highlighting} isCaptured={isCaptured} />
          ))}
        </div>
      )}
    </div>
  );
};
