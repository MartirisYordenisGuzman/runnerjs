import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDraggable } from '../hooks/useDraggable';
import { X, Package, Trash2, Search, Loader2, AlertCircle, Download, FolderOpen } from 'lucide-react';

interface NpmPackagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cwd: string | undefined;
  onChangeDirectory: () => void;
}

interface PackageInfo {
  name: string;
  version: string;
  latest?: string;
  isInstalled: boolean;
}

export function NpmPackagesModal({ isOpen, onClose, cwd, onChangeDirectory }: NpmPackagesModalProps) {
  const [searchText, setSearchText] = useState('');
  const [installedPackages, setInstalledPackages] = useState<PackageInfo[]>([]);
  const [searchResults, setSearchResults] = useState<PackageInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { position, isDragging, handleDragStart, resetPosition } = useDraggable();

  useEffect(() => {
    if (isOpen) {
      resetPosition();
    }
  }, [isOpen, resetPosition]);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadInstalledPackages = useCallback(async () => {
    if (!cwd) return;
    setIsLoading(true);
    try {
      const data = await window.electronAPI.listPackages(cwd);
      setInstalledPackages(data.map(pkg => ({ ...pkg, isInstalled: true })));
    } catch (err) {
      console.error('Failed to list packages:', err);
    }
    setIsLoading(false);
  }, [cwd]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && cwd) {
      const init = async () => {
        // Use a small delay or just run it as an async task to avoid cascading render warning
        if (isMounted) {
          setError(null);
          setSearchText('');
          setSearchResults([]);
          loadInstalledPackages();
        }
      };
      init();
    }
    return () => { isMounted = false; };
  }, [isOpen, cwd, loadInstalledPackages]);

  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await window.electronAPI.searchPackages(query);
      
      setSearchResults(results.map(pkg => {
        const found = installedPackages.find(p => p.name === pkg.name);
        return {
          ...pkg,
          latest: pkg.version,
          version: found ? found.version : '-', 
          isInstalled: !!found 
        };
      }));
    } catch (err) {
      console.error('Search failed:', err);
    }
    setIsSearching(false);
  }, [installedPackages]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 400);
  };

  const handleInstall = async (name: string) => {
    if (!cwd) return;

    setIsInstalling(true);
    setError(null);

    try {
      const result = await window.electronAPI.installPackage(name, cwd);
      
      if (result.success) {
        await loadInstalledPackages();
        setSearchResults(prev => prev.map(p => p.name === name ? { ...p, isInstalled: true, version: p.latest || p.version } : p));
      } else {
        setError(result.error || `Failed to install ${name}`);
      }
    } catch (err) {
      setError(`IPC error: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    setIsInstalling(false);
  };

  const handleUninstall = async (name: string) => {
    if (!cwd) return;
    
    setIsInstalling(true); // Re-use installing state for loading
    try {
      const result = await window.electronAPI.uninstallPackage(name, cwd);
      if (result.success) {
        await loadInstalledPackages();
        setSearchResults(prev => prev.map(p => p.name === name ? { ...p, isInstalled: false, version: '-' } : p));
      } else {
        setError(result.error || `Failed to uninstall ${name}`);
      }
    } catch (err) {
      setError(`IPC error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setIsInstalling(false);
  };

  if (!isOpen) return null;

  const bgColor = 'var(--bg-primary)';
  const textColor = 'var(--text-primary)';
  const borderColor = 'var(--border-color)';
  const inputBg = 'var(--bg-secondary)';
  const zebraBg = 'rgba(255,255,255,0.02)';

  // Merge lists: show search results if searching, otherwise show installed
  const displayPackages = searchText.length >= 2 ? searchResults : installedPackages;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000
    }} onClick={onClose}>
      <div style={{
        backgroundColor: bgColor, color: textColor,
        width: '850px', height: '600px', borderRadius: '12px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 30px 100px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255,255,255,0.08)',
        border: `1px solid ${borderColor}`,
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
            backgroundColor: 'var(--bg-toolbar)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', pointerEvents: 'none' }}>NPM Packages</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px' }}>
          
          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={searchText}
              placeholder="Search"
              onChange={handleSearchChange}
              style={{ 
                width: '100%', padding: '10px 12px 10px 38px', borderRadius: '4px', 
                border: `1px solid ${borderColor}`, backgroundColor: inputBg, color: textColor,
                fontSize: '14px', outline: 'none'
              }}
            />
            {(isSearching || isInstalling) && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <Loader2 size={16} className="animate-spin" color="var(--accent-color)" />
                </div>
            )}
          </div>

          {/* Table Container */}
          <div style={{ 
              flex: 1, 
              border: `1px solid ${borderColor}`, 
              borderRadius: '4px', 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'transparent'
          }}>
            {/* Table Header */}
            <div style={{ 
                display: 'flex', 
                padding: '10px 16px', 
                borderBottom: `1px solid ${borderColor}`,
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-toolbar)'
            }}>
                <div style={{ flex: 1 }}>Name</div>
                <div style={{ width: '150px' }}>Installed</div>
                <div style={{ width: '150px' }}>Latest</div>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* List Body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {!cwd ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <AlertCircle size={40} style={{ marginBottom: '16px', opacity: 0.3, margin: '0 auto' }} />
                  <p>Please select a working directory first.</p>
                </div>
              ) : isLoading ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px auto' }} />
                  <p>Loading packages...</p>
                </div>
              ) : displayPackages.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Package size={40} style={{ marginBottom: '16px', opacity: 0.3, margin: '0 auto' }} />
                  <p>{searchText.length >= 2 ? 'No packages found on NPM Registry.' : 'No packages found in this directory.'}</p>
                </div>
              ) : (
                displayPackages.map((pkg, index) => (
                  <div key={pkg.name} style={{ 
                      display: 'flex', 
                      padding: '12px 16px', 
                      alignItems: 'center',
                      fontSize: '13px',
                      backgroundColor: index % 2 === 0 ? 'transparent' : zebraBg,
                      borderBottom: `1px solid ${borderColor}`
                  }}>
                    <div style={{ flex: 1, fontWeight: 500, color: 'var(--accent-color)' }}>{pkg.name}</div>
                    <div style={{ width: '150px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {pkg.isInstalled ? pkg.version.replace(/[^0-9.]/g, '') : '-'}
                    </div>
                    <div style={{ width: '150px', color: 'var(--text-muted)' }}>{pkg.latest || '-'}</div>
                    <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                        {pkg.isInstalled ? (
                            <button 
                                onClick={() => handleUninstall(pkg.name)}
                                title="Uninstall package"
                                style={{ 
                                    background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', borderRadius: '4px', padding: '4px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            >
                                <Trash2 size={16} />
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleInstall(pkg.name)}
                                title="Install package"
                                style={{ 
                                    background: 'var(--accent-color)', border: 'none', color: 'white', borderRadius: '4px', padding: '4px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-color)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent-color)'}
                            >
                                <Download size={16} />
                            </button>
                        ) }
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: '16px', padding: '10px 16px', borderRadius: '4px', backgroundColor: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{error}</div>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Footer with CWD info */}
        <div style={{ 
          padding: '12px 16px', 
          borderTop: `1px solid ${borderColor}`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-toolbar)',
          fontSize: '12px',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <FolderOpen size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>Working Directory:</span>
            <span style={{ 
              color: cwd ? 'var(--text-primary)' : '#f43f5e', 
              fontFamily: 'monospace', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              backgroundColor: 'rgba(255,255,255,0.05)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              {cwd || 'Not selected'}
            </span>
          </div>
          <button 
            onClick={onChangeDirectory}
            style={{ 
              background: 'none', 
              border: `1px solid ${borderColor}`, 
              color: textColor, 
              padding: '4px 10px', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
}
