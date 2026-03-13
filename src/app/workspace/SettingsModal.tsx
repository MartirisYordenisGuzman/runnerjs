import { useState, useEffect } from 'react';
import { useDraggable } from '../hooks/useDraggable';
import { X, Settings, Wrench, Braces, Type, Sparkles, Cpu, HelpCircle } from 'lucide-react';
import type { AppSettings } from '../../shared/ipc';

type SettingsTab = 'General' | 'Build' | 'Formatting' | 'Appearance' | 'AI' | 'Advanced';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  themes: string[];
  availableFonts?: string[];
}

const TabButton = ({ id, activeTab, onSelect, icon: Icon, label, accentColor }: { id: SettingsTab, activeTab: SettingsTab, onSelect: (id: SettingsTab) => void, icon: React.ElementType, label: string, accentColor: string }) => (
  <div 
    onClick={() => onSelect(id)}
    className="tab-button"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 4px',
      cursor: 'pointer',
      color: activeTab === id ? accentColor : 'var(--text-muted)',
      backgroundColor: activeTab === id ? 'var(--bg-toolbar)' : 'transparent',
      borderRadius: '8px',
      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      minWidth: '76px',
      gap: '4px',
      position: 'relative'
    }}
    onMouseEnter={(e) => {
      if (activeTab !== id) e.currentTarget.style.backgroundColor = 'var(--bg-toolbar)';
    }}
    onMouseLeave={(e) => {
      if (activeTab !== id) e.currentTarget.style.backgroundColor = 'transparent';
    }}
  >
    <Icon size={18} style={{ transition: 'transform 0.2s ease' }} />
    <span style={{ fontSize: '10px', fontWeight: 600, opacity: activeTab === id ? 1 : 0.7 }}>{label}</span>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, marginTop: '4px' }}>{children}</div>
);

const SettingRow = ({ label, children, textColor, disabled = false }: { label: string, children: React.ReactNode, textColor: string, disabled?: boolean }) => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    marginBottom: '8px', 
    minHeight: '24px',
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    transition: 'opacity 0.2s ease'
  }}>
    <div style={{ 
      width: '130px', 
      fontSize: '11px', 
      color: textColor, 
      textAlign: 'right', 
      paddingRight: '16px',
      fontWeight: 500,
      opacity: 0.8
    }}>
      {label}
    </div>
    <div style={{ 
      width: '1px', 
      height: '14px', 
      backgroundColor: 'var(--border-color)', 
      marginRight: '16px', 
      opacity: 0.4 
    }} />
    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
      {children}
    </div>
  </div>
);

const Checkbox = ({ checked, onChange, label, textColor, accentColor, disabled = false }: { checked: boolean, onChange: (v: boolean) => void, label: string, textColor: string, accentColor: string, disabled?: boolean }) => (
  <label style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    cursor: disabled ? 'default' : 'pointer', 
    fontSize: '13px', 
    color: textColor, 
    userSelect: 'none' 
  }}>
    <div 
      onClick={() => !disabled && onChange(!checked)}
      style={{ 
        width: '18px', 
        height: '18px', 
        borderRadius: '4px', 
        border: `1px solid ${checked ? accentColor : 'var(--border-color)'}`,
        backgroundColor: checked ? accentColor : 'var(--bg-secondary)',
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease-out',
        flexShrink: 0
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
    <span style={{ opacity: checked ? 1 : 0.8 }}>{label}</span>
  </label>
);

const Select = ({ value, onChange, options, inputBg, textColor }: { value: string | number, onChange: (v: string) => void, options: (string | number | {label: string, value: string | number})[], inputBg: string, textColor: string }) => (
  <select 
    value={value} 
    onChange={(e) => onChange(e.target.value)}
    className="settings-select settings-input"
    style={{
      padding: '8px 12px',
      borderRadius: '6px',
      backgroundColor: inputBg,
      color: textColor,
      fontSize: '13px',
      outline: 'none',
      width: '100%',
      maxWidth: '240px',
      cursor: 'pointer'
    }}
  >
    {options.map(opt => {
      const label = typeof opt === 'object' ? opt.label : String(opt);
      const val = typeof opt === 'object' ? opt.value : opt;
      return (
        <option key={String(val)} value={val}>
          {label}
        </option>
      );
    })}
  </select>
);

export function SettingsModal({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdate, 
  themes,
  availableFonts = ['JetBrains Mono', 'Fira Code', 'Segoe UI', 'Arial']
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('General');
  const { position, isDragging, handleDragStart, resetPosition } = useDraggable();

  useEffect(() => {
    if (isOpen) {
      resetPosition();
    }
  }, [isOpen, resetPosition]);

  if (!isOpen) return null;

  const updateSetting = <C extends keyof AppSettings>(
    category: C, 
    key: string, 
    value: any
  ) => {
    onUpdate({
      ...settings,
      [category]: {
        ...(settings[category] as Record<string, any>),
        [key]: value
      }
    });
  };

  const bgColor = 'var(--bg-primary)';
  const textColor = 'var(--text-primary)';
  const borderColor = 'var(--border-color)';
  const inputBg = 'var(--bg-secondary)';
  const headerBg = 'var(--bg-toolbar)';
  const accentColor = 'var(--accent-color)';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: bgColor, color: textColor,
        width: '720px', maxHeight: '90vh', borderRadius: '12px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 30px 100px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-color)',
        border: `1px solid ${borderColor}`,
        position: 'relative',
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        userSelect: isDragging ? 'none' : 'auto',
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div 
          onMouseDown={handleDragStart}
          style={{ 
            padding: '12px 16px 8px 16px', 
            borderBottom: `1px solid ${borderColor}`,
            backgroundColor: headerBg,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          {/* Top Row: Title & Close */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: textColor, opacity: 0.9, pointerEvents: 'none' }}>{activeTab}</h2>
            <button onClick={onClose} style={{ 
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px',
              borderRadius: '4px', transition: 'background-color 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-toolbar)'} 
               onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <X size={16} />
            </button>
          </div>

          {/* Centered Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '2px'
          }} className="tab-button-container">
            <TabButton id="General" activeTab={activeTab} onSelect={setActiveTab} icon={Settings} label="General" accentColor={accentColor} />
            <TabButton id="Build" activeTab={activeTab} onSelect={setActiveTab} icon={Wrench} label="Build" accentColor={accentColor} />
            <TabButton id="Formatting" activeTab={activeTab} onSelect={setActiveTab} icon={Braces} label="Formatting" accentColor={accentColor} />
            <TabButton id="Appearance" activeTab={activeTab} onSelect={setActiveTab} icon={Type} label="Appearance" accentColor={accentColor} />
            <TabButton id="AI" activeTab={activeTab} onSelect={setActiveTab} icon={Sparkles} label="AI" accentColor={accentColor} />
            <TabButton id="Advanced" activeTab={activeTab} onSelect={setActiveTab} icon={Cpu} label="Advanced" accentColor={accentColor} />
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
          
          {activeTab === 'General' && (
            <div>
              <SettingRow label="Auto-Run" textColor={textColor}>
                <Checkbox checked={settings.general.autoRun} onChange={(v) => updateSetting('general', 'autoRun', v)} label="Automatically run code on change" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Line Wrap" textColor={textColor}>
                <Checkbox checked={settings.general.lineWrap} onChange={(v) => updateSetting('general', 'lineWrap', v)} label="Wrap long lines" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Vim Keys" textColor={textColor}>
                <Checkbox checked={settings.general.vimKeys} onChange={(v) => updateSetting('general', 'vimKeys', v)} label="Use Vim key-bindings" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Close Brackets" textColor={textColor}>
                <Checkbox checked={settings.general.autoCloseBrackets} onChange={(v) => updateSetting('general', 'autoCloseBrackets', v)} label="Auto-close brackets" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Scrolling" textColor={textColor}>
                <Select 
                    value={settings.general.scrolling} 
                    onChange={(v: string) => updateSetting('general', 'scrolling', v)} 
                    options={['Automatic', 'None']} 
                    inputBg={inputBg}
                    textColor={textColor}
                />
              </SettingRow>
              <SettingRow label="Confirm Close" textColor={textColor}>
                <Checkbox checked={settings.general.confirmClose} onChange={(v) => updateSetting('general', 'confirmClose', v)} label="Ask before closing tab" textColor={textColor} accentColor={accentColor} />
              </SettingRow>

              <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '12px 0 16px 0' }} />

              <SettingRow label="Autocomplete" textColor={textColor}>
                <Checkbox checked={settings.general.autocomplete} onChange={(v) => updateSetting('general', 'autocomplete', v)} label="Show suggestions while typing" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Linting" textColor={textColor}>
                <Checkbox checked={settings.general.linting} onChange={(v) => updateSetting('general', 'linting', v)} label="Show inline errors and warnings" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Hover Info" textColor={textColor}>
                <Checkbox checked={settings.general.hoverInfo} onChange={(v) => updateSetting('general', 'hoverInfo', v)} label="Show information on hover" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Signatures" textColor={textColor}>
                <Checkbox checked={settings.general.signatures} onChange={(v) => updateSetting('general', 'signatures', v)} label="Show function signatures while typing" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
            </div>
          )}

          {activeTab === 'Build' && (
            <div>
              <SectionTitle>Transform:</SectionTitle>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: '4px', padding: '12px 16px', marginBottom: '24px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <Checkbox 
                    checked={settings.build.transform.typescript} 
                    onChange={(v) => onUpdate({...settings, build: {...settings.build, transform: {...settings.build.transform, typescript: v}}})} 
                    label="TypeScript" 
                    textColor={textColor}
                    accentColor={accentColor}
                  />
                </div>
                <div>
                  <Checkbox 
                    checked={settings.build.transform.jsx} 
                    onChange={(v) => onUpdate({...settings, build: {...settings.build, transform: {...settings.build.transform, jsx: v}}})} 
                    label="JSX" 
                    textColor={textColor}
                    accentColor={accentColor}
                  />
                </div>
              </div>

              <SectionTitle>Proposals:</SectionTitle>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: '4px', overflow: 'hidden' }}>
                {Object.entries(settings.build.proposals).map(([key, value], idx, arr) => (
                  <div key={key} style={{ 
                    padding: '8px 16px', 
                    borderBottom: idx === arr.length - 1 ? 'none' : `1px solid ${borderColor}`,
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                  }}>
                    <Checkbox 
                      checked={value} 
                      onChange={(v) => onUpdate({...settings, build: {...settings.build, proposals: {...settings.build.proposals, [key]: v}}})} 
                      label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} 
                      textColor={textColor}
                      accentColor={accentColor}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Formatting' && (
            <div>
              <SettingRow label="Auto-Format" textColor={textColor}>
                <Checkbox checked={settings.formatting.autoFormat} onChange={(v) => updateSetting('formatting', 'autoFormat', v)} label="Automatically format code on run" textColor={textColor} accentColor={accentColor} />
              </SettingRow>

              <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '20px 0 24px 0' }} />

              <SettingRow label="Print Width" textColor={textColor}>
                <input 
                  type="number" 
                  value={settings.formatting.printWidth} 
                  onChange={(e) => updateSetting('formatting', 'printWidth', parseInt(e.target.value))}
                  className="settings-input"
                  style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: inputBg, color: textColor, width: '80px', fontSize: '13px', outline: 'none' }}
                />
              </SettingRow>
              <SettingRow label="Tab Width" textColor={textColor}>
                <input 
                  type="number" 
                  value={settings.formatting.tabWidth} 
                  onChange={(e) => updateSetting('formatting', 'tabWidth', parseInt(e.target.value))}
                  className="settings-input"
                  style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: inputBg, color: textColor, width: '80px', fontSize: '13px', outline: 'none' }}
                />
              </SettingRow>
              <SettingRow label="Semicolons" textColor={textColor}>
                <Checkbox checked={settings.formatting.semicolons} onChange={(v) => updateSetting('formatting', 'semicolons', v)} label="Print semicolons at the ends of statements" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Single Quotes" textColor={textColor}>
                <Checkbox checked={settings.formatting.singleQuotes} onChange={(v) => updateSetting('formatting', 'singleQuotes', v)} label="Use single quotes instead of double quotes" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Quote Props" textColor={textColor}>
                <Select 
                    value={settings.formatting.quoteProps} 
                    onChange={(v: string) => updateSetting('formatting', 'quoteProps', v)} 
                    options={['as-needed', 'always', 'consistent']} 
                    inputBg={inputBg}
                    textColor={textColor}
                />
              </SettingRow>
              <SettingRow label="JSX Quotes" textColor={textColor}>
                <Checkbox checked={settings.formatting.jsxQuotes} onChange={(v) => updateSetting('formatting', 'jsxQuotes', v)} label="Use single quotes instead of double quotes in JSX" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Trailing Commas" textColor={textColor}>
                <Select 
                    value={settings.formatting.trailingCommas} 
                    onChange={(v: string) => updateSetting('formatting', 'trailingCommas', v)} 
                    options={['none', 'es5', 'all']} 
                    inputBg={inputBg}
                    textColor={textColor}
                />
              </SettingRow>
              <SettingRow label="Bracket Spacing" textColor={textColor}>
                <Checkbox checked={settings.formatting.bracketSpacing} onChange={(v) => updateSetting('formatting', 'bracketSpacing', v)} label="Print spaces between brackets in object literals" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Arrow Function Parentheses" textColor={textColor}>
                <Select 
                    value={settings.formatting.arrowFunctionParentheses} 
                    onChange={(v: string) => updateSetting('formatting', 'arrowFunctionParentheses', v)} 
                    options={['always', 'avoid']} 
                    inputBg={inputBg}
                    textColor={textColor}
                />
              </SettingRow>
            </div>
          )}

          {activeTab === 'Appearance' && (
            <div>
              <SettingRow label="Theme" textColor={textColor}>
                <Select 
                    value={settings.appearance.theme} 
                    onChange={(v: string) => updateSetting('appearance', 'theme', v)} 
                    options={themes} 
                    inputBg={inputBg}
                    textColor={textColor}
                />
              </SettingRow>
              <SettingRow label="Font" textColor={textColor}>
                <Select 
                    value={settings.appearance.font} 
                    onChange={(v: string) => updateSetting('appearance', 'font', v)} 
                    options={availableFonts} 
                    inputBg={inputBg}
                    textColor={textColor}
                />
              </SettingRow>
              <SettingRow label="Font Size" textColor={textColor}>
                <input 
                  type="number" 
                  value={settings.appearance.fontSize} 
                  onChange={(e) => updateSetting('appearance', 'fontSize', parseInt(e.target.value))}
                  className="settings-input"
                  style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: inputBg, color: textColor, width: '80px', fontSize: '13px', outline: 'none' }}
                />
              </SettingRow>
              <SettingRow label="Line Numbers" textColor={textColor}>
                <Checkbox checked={settings.appearance.showLineNumbers} onChange={(v) => updateSetting('appearance', 'showLineNumbers', v)} label="Show line numbers" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Invisibles" textColor={textColor}>
                <Checkbox checked={settings.appearance.showInvisibles} onChange={(v) => updateSetting('appearance', 'showInvisibles', v)} label="Show invisible characters" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Active Line" textColor={textColor}>
                <Checkbox checked={settings.appearance.highlightActiveLine} onChange={(v) => updateSetting('appearance', 'highlightActiveLine', v)} label="Highlight active line" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Tab Bar" textColor={textColor}>
                <Checkbox checked={settings.appearance.showTabBar} onChange={(v) => updateSetting('appearance', 'showTabBar', v)} label="Show tab bar for single tab" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Output Highlighting" textColor={textColor}>
                <Checkbox checked={settings.appearance.outputHighlighting} onChange={(v) => updateSetting('appearance', 'outputHighlighting', v)} label="Show syntax highlighting on output" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Activity Bar" textColor={textColor}>
                <Checkbox checked={settings.appearance.showActivityBar} onChange={(v) => updateSetting('appearance', 'showActivityBar', v)} label="Show activity bar" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
              <SettingRow label="Console Footer" textColor={textColor}>
                <Checkbox checked={settings.appearance.showConsoleHeader} onChange={(v) => updateSetting('appearance', 'showConsoleHeader', v)} label="Show 'Console Output' footer" textColor={textColor} accentColor={accentColor} />
              </SettingRow>
            </div>
          )}

          {activeTab === 'AI' && (
            <div>
              <SettingRow label="AI Provider" textColor={textColor}>
                <Select 
                    value={settings.ai.provider} 
                    onChange={(v: string) => updateSetting('ai', 'provider', v)} 
                    options={[
                      { label: 'OpenAI', value: 'openai' },
                      { label: 'Google Gemini', value: 'gemini' }
                    ]} 
                    inputBg={inputBg}
                    textColor={textColor}
                />
              </SettingRow>

              <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '16px 0' }} />

              {settings.ai.provider === 'openai' ? (
                <>
                  <SettingRow label="OpenAI Model" textColor={textColor}>
                    <Select 
                        value={settings.ai.openaiModel} 
                        onChange={(v: string) => updateSetting('ai', 'openaiModel', v)} 
                        options={[
                          { label: 'GPT-4o', value: 'gpt-4o' },
                          { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
                          { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                          { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
                        ]} 
                        inputBg={inputBg}
                        textColor={textColor}
                    />
                  </SettingRow>
                  <SettingRow label="OpenAI API Key" textColor={textColor}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                      <input 
                        type="password" 
                        value={settings.ai.openaiApiKey} 
                        onChange={(e) => updateSetting('ai', 'openaiApiKey', e.target.value)}
                        placeholder="sk-..."
                        className="settings-input"
                        style={{ 
                          padding: '8px 12px', borderRadius: '6px', 
                          backgroundColor: inputBg, color: textColor,
                          fontSize: '13px', outline: 'none', width: '100%'
                        }}
                      />
                    </div>
                  </SettingRow>
                </>
              ) : (
                <>
                  <SettingRow label="Gemini Model" textColor={textColor}>
                    <Select 
                        value={settings.ai.geminiModel} 
                        onChange={(v: string) => updateSetting('ai', 'geminiModel', v)} 
                        options={[
                          { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
                          { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
                          { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
                          { label: 'Gemini Flash (Latest)', value: 'gemini-flash-latest' }
                        ]} 
                        inputBg={inputBg}
                        textColor={textColor}
                    />
                  </SettingRow>
                  <SettingRow label="Gemini API Key" textColor={textColor}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                      <input 
                        type="password" 
                        value={settings.ai.geminiApiKey} 
                        onChange={(e) => updateSetting('ai', 'geminiApiKey', e.target.value)}
                        placeholder="Paste your Gemini key here..."
                        className="settings-input"
                        style={{ 
                          padding: '8px 12px', borderRadius: '6px', 
                          backgroundColor: inputBg, color: textColor,
                          fontSize: '13px', outline: 'none', width: '100%'
                        }}
                      />
                    </div>
                  </SettingRow>
                  <div style={{ marginLeft: '146px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '-4px' }}>
                    <p>Free tier available at <a href="https://aistudio.google.com/app/apikey" target="_blank" style={{ color: 'var(--accent-color)' }}>Google AI Studio</a></p>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'Advanced' && (
            <div>
              <SettingRow label="Expression Results" textColor={textColor}>
                <Checkbox 
                  checked={settings.advanced.expressionResults} 
                  onChange={(v) => {
                    updateSetting('advanced', 'expressionResults', v);
                    if (!v) updateSetting('advanced', 'matchLines', false);
                  }} 
                  label="Show the result of each top-level expression" 
                  textColor={textColor} 
                  accentColor={accentColor} 
                />
              </SettingRow>
              <SettingRow 
                label="Match Lines" 
                textColor={textColor}
                disabled={!settings.advanced.expressionResults}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Checkbox 
                    checked={settings.advanced.matchLines} 
                    disabled={!settings.advanced.expressionResults}
                    onChange={(v) => updateSetting('advanced', 'matchLines', v)} 
                    label="Align output results with source" 
                    textColor={textColor} 
                    accentColor={accentColor} 
                  />
                  <HelpCircle size={16} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                </div>
              </SettingRow>
              <SettingRow label="Show Undefined" textColor={textColor}>
                <Checkbox 
                  checked={settings.advanced.showUndefined} 
                  onChange={(v) => updateSetting('advanced', 'showUndefined', v)} 
                  label="Show undefined values" 
                  textColor={textColor} 
                  accentColor={accentColor} 
                />
              </SettingRow>
              <SettingRow label="Loop Protection" textColor={textColor}>
                <Checkbox 
                  checked={settings.advanced.loopProtection} 
                  onChange={(v) => updateSetting('advanced', 'loopProtection', v)} 
                  label="Protect against long running loops" 
                  textColor={textColor} 
                  accentColor={accentColor} 
                />
              </SettingRow>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
