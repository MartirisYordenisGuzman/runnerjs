import { useState, useEffect, useMemo } from 'react';
import { useDraggable } from '../hooks/useDraggable';
import { Search, Plus, Minus, X, Info } from 'lucide-react';
import { CodeEditor } from '../editor';
import type { Snippet } from '../../shared/ipc';
import { registerSnippetSuggestions } from '../../core/snippets/SnippetRegistry';

interface SnippetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (code: string, newTab: boolean) => void;
  theme: string;
}

export function SnippetsModal({ isOpen, onClose, onInsert, theme }: SnippetsModalProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { position, isDragging, handleDragStart, resetPosition } = useDraggable();

  useEffect(() => {
    if (isOpen) {
      resetPosition();
    }
  }, [isOpen, resetPosition]);

  // Load snippets on open
  useEffect(() => {
    if (isOpen) {
      window.electronAPI.getSnippets().then(data => {
        setSnippets(data);
        registerSnippetSuggestions(null, data);
        setSelectedSnippetId(currentId => {
          if (!currentId && data.length > 0) return data[0].id;
          return currentId;
        });
      });
    }
  }, [isOpen]);

  const selectedSnippet = useMemo(() => 
    snippets.find(s => s.id === selectedSnippetId) || null
  , [snippets, selectedSnippetId]);

  const filteredSnippets = useMemo(() => 
    snippets.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  , [snippets, searchQuery]);

  const handleSave = async (updatedFields: Partial<Snippet>) => {
    if (!selectedSnippet) return;
    const updated = { ...selectedSnippet, ...updatedFields };
    await window.electronAPI.saveSnippet(updated);
    setSnippets(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const createSnippet = async () => {
    const newSnippet: Snippet = {
      id: `snip-${Date.now()}`,
      name: 'New Snippet',
      description: '',
      code: '// Enter code here',
      timestamp: Date.now()
    };
    await window.electronAPI.saveSnippet(newSnippet);
    setSnippets(prev => [...prev, newSnippet]);
    setSelectedSnippetId(newSnippet.id);
  };

  const deleteSnippet = async () => {
    if (!selectedSnippetId) return;
    await window.electronAPI.deleteSnippet(selectedSnippetId);
    const newSnippets = snippets.filter(s => s.id !== selectedSnippetId);
    setSnippets(newSnippets);
    setSelectedSnippetId(newSnippets.length > 0 ? newSnippets[0].id : null);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        width: '900px',
        height: '600px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        boxShadow: '0 30px 100px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255,255,255,0.08)',
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        userSelect: isDragging ? 'none' : 'auto',
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div 
          onMouseDown={handleDragStart}
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-toolbar)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>Snippets</span>
          <X size={18} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left Sidebar */}
          <div style={{
            width: '280px',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-secondary)'
          }}>
            <div style={{ padding: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-toolbar)',
                borderRadius: '6px',
                padding: '0 10px',
                border: '1px solid var(--border-color)'
              }}>
                <Search size={14} color="var(--text-muted)" />
                <input 
                  type="text" 
                  placeholder="Search" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    padding: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    width: '100%',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredSnippets.map(snip => (
                <div 
                  key={snip.id}
                  onClick={() => setSelectedSnippetId(snip.id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: selectedSnippetId === snip.id ? 'var(--accent-color)' : 'transparent',
                    color: selectedSnippetId === snip.id ? 'white' : 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', opacity: 0.7 }}>{snip.code.substring(0, 30)}...</div>
                  <div style={{ fontSize: '13px' }}>{snip.name}</div>
                </div>
              ))}
            </div>

            <div style={{
              padding: '8px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '8px'
            }}>
              <button 
                onClick={createSnippet}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                <Plus size={18} />
              </button>
              <button 
                onClick={deleteSnippet}
                disabled={!selectedSnippetId}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  cursor: selectedSnippetId ? 'pointer' : 'default',
                  opacity: selectedSnippetId ? 1 : 0.3,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                <Minus size={18} />
              </button>
            </div>
          </div>

          {/* Main Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
            {selectedSnippet ? (
              <>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      value={selectedSnippet.name}
                      onChange={(e) => handleSave({ name: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-toolbar)',
                        border: '1px solid var(--border-color)',
                        padding: '10px 12px',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                    <Info size={14} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Description"
                    value={selectedSnippet.description}
                    onChange={(e) => handleSave({ description: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      padding: '4px 0',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--border-color)', margin: '0 20px', borderRadius: '4px', overflow: 'hidden' }}>
                  <CodeEditor 
                    code={selectedSnippet.code}
                    onChange={(val) => handleSave({ code: val || '' })}
                    theme={theme}
                    fontSize={13}
                  />
                </div>

                <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                   <button 
                    onClick={() => onInsert(selectedSnippet.code, true)}
                    style={{
                      backgroundColor: 'var(--bg-toolbar)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}>
                    Insert Snippet in New Tab
                  </button>
                  <button 
                    onClick={() => onInsert(selectedSnippet.code, false)}
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}>
                    Insert Snippet
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Select or create a snippet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
