import { useState, useEffect } from 'react';
import { useDraggable } from '../hooks/useDraggable';
import { X } from 'lucide-react';

interface EditTitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTitle: string;
  onUpdate: (newTitle: string) => void;
}

export function EditTitleModal({ isOpen, onClose, currentTitle, onUpdate }: EditTitleModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const { position, isDragging, handleDragStart, resetPosition } = useDraggable();

  useEffect(() => {
    if (isOpen) {
      resetPosition();
    }
  }, [isOpen, resetPosition]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (title.trim()) {
      onUpdate(title.trim());
      onClose();
    }
  };

  const bgColor = 'var(--bg-primary)';
  const textColor = 'var(--text-primary)';
  const borderColor = 'var(--border-color)';
  const inputBg = 'var(--bg-secondary)';
  const headerBg = 'var(--bg-toolbar)';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000
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
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', pointerEvents: 'none' }}>Edit Tab Title</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tab Title</label>
            <input 
              autoFocus
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              style={{ 
                padding: '8px 12px', borderRadius: '4px', 
                border: `1px solid ${borderColor}`, backgroundColor: inputBg, color: textColor,
                fontSize: '13px', outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button 
              type="button"
              onClick={onClose}
              style={{ 
                padding: '6px 16px', borderRadius: '4px', border: `1px solid ${borderColor}`, 
                backgroundColor: 'transparent', color: textColor, cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!title.trim()}
              style={{ 
                padding: '6px 20px', borderRadius: '4px', border: 'none', 
                backgroundColor: 'var(--accent-color)', color: 'white', cursor: !title.trim() ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 500, opacity: !title.trim() ? 0.5 : 1
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
