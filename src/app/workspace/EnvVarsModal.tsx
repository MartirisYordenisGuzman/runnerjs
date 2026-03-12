import { useState, useEffect } from 'react';
import { useDraggable } from '../hooks/useDraggable';
import { X, Trash2, HelpCircle } from 'lucide-react';

interface EnvVarsModalProps {
  isOpen: boolean;
  onClose: () => void;
  envVars: Record<string, string>;
  onUpdate: (vars: Record<string, string>) => void;
}

export function EnvVarsModal({ isOpen, onClose, envVars, onUpdate }: EnvVarsModalProps) {
  const [localVars, setLocalVars] = useState<[string, string][]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { position, isDragging, handleDragStart, resetPosition } = useDraggable();

  useEffect(() => {
    if (isOpen) {
      resetPosition();
    }
  }, [isOpen, resetPosition]);

  useEffect(() => {
    if (isOpen) {
      setLocalVars(Object.entries(envVars) as [string, string][]);
      setMessage(null);
      setNewKey('');
      setNewValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!newKey.trim()) return;
    
    // Check if key already exists
    if (localVars.some(([k]) => k === newKey.trim())) {
        setMessage({ type: 'error', text: 'Variable already exists' });
        return;
    }

    const updatedVars: [string, string][] = [...localVars, [newKey.trim(), newValue]];
    setLocalVars(updatedVars);
    setNewKey('');
    setNewValue('');
    
    // Auto-save on add
    saveVars(updatedVars);
  };

  const handleRemove = (index: number) => {
    const updatedVars = localVars.filter((_, i) => i !== index) as [string, string][];
    setLocalVars(updatedVars);
    saveVars(updatedVars);
  };

  const saveVars = async (vars: [string, string][]) => {
    const envRecord: Record<string, string> = {};
    vars.forEach(([k, v]) => {
      envRecord[k] = v;
    });

    const result = await window.electronAPI.saveEnvVars(envRecord);
    if (result.success) {
      onUpdate(envRecord);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to sync variables' });
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
        width: '750px', height: '500px', borderRadius: '12px',
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
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', pointerEvents: 'none' }}>Environment Variables</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form at Top */}
        <div style={{ padding: '20px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input 
            type="text" 
            value={newKey} 
            placeholder="KEY"
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
            style={{ 
              flex: 1, padding: '8px 12px', borderRadius: '4px', 
              border: `1px solid ${borderColor}`, backgroundColor: inputBg, color: textColor,
              fontSize: '13px', outline: 'none'
            }}
          />
          <input 
            type="text" 
            value={newValue} 
            placeholder="VALUE"
            onChange={(e) => setNewValue(e.target.value)}
            style={{ 
              flex: 1, padding: '8px 12px', borderRadius: '4px', 
              border: `1px solid ${borderColor}`, backgroundColor: inputBg, color: textColor,
              fontSize: '13px', outline: 'none'
            }}
          />
          <button 
            onClick={handleAdd}
            disabled={!newKey.trim()}
            style={{ 
              padding: '8px 24px', borderRadius: '4px', border: 'none', 
              backgroundColor: 'var(--accent-color)', color: 'white', cursor: !newKey.trim() ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 500, opacity: !newKey.trim() ? 0.5 : 1
            }}
          >
            Add
          </button>
        </div>

        {/* Divider-like Border Container */}
        <div style={{ 
            margin: '0 24px 20px 24px', 
            flex: 1, 
            border: `1px solid ${borderColor}`, 
            borderRadius: '4px', 
            backgroundColor: 'transparent',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {localVars.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '0 40px' }}>
                    <div style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px' }}>No environment variables yet.</div>
                    <div style={{ fontSize: '14px' }}>Use the form above to add environment variables.</div>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {localVars.map(([key, value], index) => (
                        <div key={index} style={{ 
                            display: 'flex', 
                            padding: '10px 16px', 
                            borderBottom: index === localVars.length - 1 ? 'none' : `1px solid ${borderColor}`,
                            alignItems: 'center',
                            backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                        }}>
                            <div style={{ flex: 1, fontSize: '13px', fontFamily: 'monospace', color: 'var(--accent-color)' }}>{key}</div>
                            <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                            <button 
                                onClick={() => handleRemove(index)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Bottom Help Icon */}
        <div style={{ position: 'absolute', bottom: '16px', right: '16px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <HelpCircle size={20} />
        </div>

        {message && (
            <div style={{ 
                position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: message.type === 'error' ? '#f43f5e' : '#10b981',
                color: 'white', padding: '6px 16px', borderRadius: '4px', fontSize: '12px',
                zIndex: 10
            }}>
                {message.text}
            </div>
        )}
      </div>
    </div>
  );
}
