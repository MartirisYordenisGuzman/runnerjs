import { useDraggable } from '../hooks/useDraggable';
import { X, AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel',
  isDanger = false
}: ConfirmModalProps) {
  const { position, isDragging, handleDragStart, resetPosition } = useDraggable();

  useEffect(() => {
    if (isOpen) {
      resetPosition();
    }
  }, [isOpen, resetPosition]);

  if (!isOpen) return null;

  const bgColor = 'var(--bg-primary)';
  const textColor = 'var(--text-primary)';
  const borderColor = 'var(--border-color)';
  const headerBg = 'var(--bg-toolbar)';
  const accentColor = isDanger ? 'var(--color-error)' : 'var(--accent-color)';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000
    }} onClick={onClose}>
      <div style={{
        backgroundColor: bgColor, color: textColor,
        width: '400px', borderRadius: '12px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 30px 100px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255,255,255,0.08)',
        border: `1px solid ${borderColor}`,
        position: 'relative',
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        userSelect: isDragging ? 'none' : 'auto',
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div 
          onMouseDown={handleDragStart}
          style={{ 
            padding: '12px 16px', 
            borderBottom: `1px solid ${borderColor}`, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            backgroundColor: headerBg,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
            <AlertTriangle size={16} color={accentColor} />
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 20px', fontSize: '14px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
          {message}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: 'rgba(0,0,0,0.1)', 
          borderTop: `1px solid ${borderColor}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button 
            onClick={onClose}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              border: `1px solid ${borderColor}`,
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {cancelLabel}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{ 
              padding: '8px 24px', 
              borderRadius: '6px', 
              border: 'none',
              backgroundColor: accentColor,
              color: '#000',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
