import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Bot, User, AlertCircle, Loader2, Copy, Check, Terminal, Code2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ChatMessage } from '../../shared/ipc';

interface AIChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isLoading: boolean;
  provider: 'openai' | 'gemini' | 'anthropic' | 'deepseek' | string | undefined;
  apiKey: string;
  currentCode: string;
  onOpenSettings: () => void;
  onSendMessage: (messages: ChatMessage[]) => Promise<{ success?: boolean; error?: string }>;
}

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
  inline?: boolean;
}

const CodeBlock = ({ children, className, inline }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return <code style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>{children}</code>;
  }

  const Icon = match ? Terminal : Code2;

  return (
    <div style={{ position: 'relative', margin: '20px 0', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#0f0f10', border: '1px solid rgba(255,255,255,0.05)', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon size={14} style={{ opacity: 0.8 }} />
          <span style={{ fontWeight: 600, letterSpacing: '0.05em', opacity: 0.8 }}>{lang.toUpperCase() || 'CODE'}</span>
        </div>
        <button 
          onClick={handleCopy}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <SyntaxHighlighter
          language={lang || 'javascript'}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '20px',
            fontSize: '13px',
            backgroundColor: 'transparent',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'var(--font-mono)',
            }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export const AIChat: React.FC<AIChatProps> = ({ 
  messages, 
  setMessages, 
  isLoading, 
  provider, 
  apiKey, 
  currentCode, 
  onOpenSettings,
  onSendMessage
}) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    setError(null);

    const userMessage: ChatMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    
    // Update local state immediately so user sees their message
    setMessages(newMessages);
    
    // Create context-aware system prompt for the API call
    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `You are an expert JavaScript developer assistant. You help the user with their code in an interactive playground.
Current code in the editor:
\`\`\`javascript
${currentCode}
\`\`\`
Provide concise, helpful, and accurate suggestions. If you provide code, always wrap it in markdown code blocks with the language specified (e.g., \`\`\`javascript).`
    };

    const result = await onSendMessage([systemPrompt, ...newMessages]);
    if (result && result.error) {
      setError(result.error);
    }
    setInput('');
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  if (!apiKey) {
    const providerConfig: Record<string, { name: string, link: string }> = {
      openai: { name: 'OpenAI', link: "https://platform.openai.com/api-keys" },
      gemini: { name: 'Google Gemini', link: "https://aistudio.google.com/app/apikey" },
      anthropic: { name: 'Anthropic', link: "https://console.anthropic.com/settings/keys" },
      deepseek: { name: 'DeepSeek', link: "https://platform.deepseek.com/api_keys" },
      mistral: { name: 'Mistral AI', link: "https://console.mistral.ai/api-keys/" }
    };

    const config = providerConfig[provider || 'openai'] || providerConfig.openai;

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        backgroundColor: 'var(--bg-secondary)',
        padding: '24px',
        color: 'var(--text-primary)',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>AI Chat</h2>
        </div>
        
        <div style={{ 
          marginTop: '20px',
          padding: '16px', 
          backgroundColor: 'var(--bg-toolbar)', 
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px', color: '#eab308' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{config.name} API Key Required</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            To use this feature, please enter your {config.name} API key in the <span 
              onClick={onOpenSettings}
              style={{ color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline' }}
            >settings</span>.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            To find out how to get a {config.name} API key, please refer to the documentation: 
            <a href={config.link} target="_blank" style={{ color: 'var(--accent-color)', marginLeft: '4px' }}>{config.name} Docs</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      borderRight: '1px solid var(--border-color)',
      width: '100%'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600 }}>AI Chat</h2>
        <button 
          onClick={clearChat}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            padding: '4px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Clear chat"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {messages.length === 0 && (
          <div style={{ 
            marginTop: '20px', 
            padding: '24px',
            borderRadius: '16px',
            background: 'var(--bg-toolbar)',
            border: '1px solid var(--border-color)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '12px', 
                background: 'var(--accent-color)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
              }}>
                <Bot size={24} color="#fff" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>AI Chat</h3>
            </div>
            
            <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '12px' }}>
              AI Chat is an on-demand coding assistant ready to help with everything from generating code snippets to answering programming questions and explaining complex code.
            </p>
            
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              AI Chat is also very handy for generating code snippets. For example, if you need a quick function to filter an array of numbers based on certain conditions, you could simply type, <span style={{ fontStyle: 'italic', color: 'var(--accent-color)' }}>"Generate a function to filter an array for numbers greater than 10."</span> AI Chat will quickly provide a code snippet for you to use.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '8px',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div style={{ 
                padding: msg.role === 'user' ? '10px 14px' : '0',
                borderRadius: msg.role === 'user' ? '12px' : '0',
                fontSize: '13px',
                lineHeight: '1.6',
                backgroundColor: msg.role === 'user' ? 'var(--accent-color)' : 'transparent',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                border: 'none',
                boxShadow: 'none',
                // Ensure long strings (URLs, errors) wrap properly
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                whiteSpace: 'pre-wrap',
                boxSizing: 'border-box',
                // Adjust width based on role: User messages are constrained, AI takes full width minus a tiny margin
                width: msg.role === 'user' ? 'fit-content' : '99%',
                maxWidth: msg.role === 'user' ? '85%' : '99%'
            }}>
              {msg.role === 'user' ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              ) : (
                <div className="markdown-content" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: CodeBlock,
                      p: ({ children }) => <p style={{ margin: '10px 0' }}>{children}</p>,
                      ul: ({ children }) => <ul style={{ marginLeft: '20px', margin: '10px 0' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ marginLeft: '20px', margin: '10px 0' }}>{children}</ol>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              <Bot size={12} />
              AI
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: 'var(--bg-toolbar)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" />
              <span style={{ fontSize: '13px' }}>Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '13px',
            display: 'flex',
            gap: '8px',
            // Ensure long error messages (API errors, stack traces) wrap
            wordBreak: 'break-word',
            overflowWrap: 'anywhere'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{error}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '8px 12px',
          transition: 'all 0.2s ease',
          cursor: 'text'
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-color)';
          e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent-color)';
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Enter a prompt here..."
            style={{ 
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              padding: '4px 0',
              color: 'var(--text-primary)',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              minHeight: '24px',
              maxHeight: '160px',
              fontFamily: 'inherit'
            }}
            rows={1}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{ 
              background: 'none',
              border: 'none',
              color: input.trim() && !isLoading ? 'var(--accent-color)' : 'var(--text-muted)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isLoading ? 'pointer' : 'default',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.5 : 1
            }}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
