import React, { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';

interface MenuItemProps {
  name?: string;
  color?: string;
  shortcut?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  hasSubmenu?: boolean;
  isChecked?: boolean;
  isDot?: boolean;
  isSeparator?: boolean;
  palette?: string[];
  icon?: React.ReactNode;
  isActive?: boolean;
}

export const MenuItem = ({ 
  name, 
  color, 
  shortcut, 
  onClick, 
  onMouseEnter, 
  hasSubmenu, 
  isChecked, 
  isDot, 
  isSeparator, 
  palette, 
  icon, 
  isActive 
}: MenuItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  
  if (isSeparator) {
    return <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0', opacity: 0.5 }} />;
  }

  return (
    <div 
      style={{ 
        padding: '4px 12px', 
        cursor: 'pointer', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: (isHovered || isActive) ? 'var(--bg-item-hover)' : 'transparent',
        filter: isActive ? 'brightness(1.5)' : 'none',
        transition: 'all 0.1s ease',
        borderRadius: '4px',
        margin: '0 4px',
        minHeight: '26px'
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (onMouseEnter) onMouseEnter();
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {isChecked && !isDot && <Check size={14} color="var(--accent-color)" strokeWidth={3} />}
          {isDot && (
            <div style={{ 
              width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {isChecked && <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--accent-color)' }} />}
            </div>
          )}
          {!isChecked && !isDot && icon && <div style={{ opacity: 0.8 }}>{icon}</div>}
        </div>
        {palette && (
            <div style={{ display: 'flex', height: '10px', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', marginRight: '4px' }}>
                {palette.map((c, i) => <div key={i} style={{ width: '10px', backgroundColor: c }} />)}
            </div>
        )}
        <span style={{ 
          color: color || 'var(--text-primary)', 
          fontWeight: (isHovered || isActive) ? 600 : 400,
          fontSize: '12px',
          opacity: (isHovered || isActive) ? 1 : 0.85,
          whiteSpace: 'nowrap'
        }}>
          {name}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '16px', whiteSpace: 'nowrap', paddingRight: '4px' }}>
        {shortcut && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>{shortcut}</span>}
        {hasSubmenu && <ChevronRight size={13} color="var(--text-muted)" />}
      </div>
    </div>
  );
};

export default React.memo(MenuItem);
