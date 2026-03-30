
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, Bot, Loader2, 
  ChevronRight, Sparkles, Plus, ChevronDown, Mic, FileCode, FileText, Image as ImageIcon
} from 'lucide-react';
import { ProjectType } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatAssistantProps {
  activeProject: ProjectType;
  activeFileContent?: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onFileSelect?: (file: { name: string, content: string }) => void;
  onRunInTerminal?: (cmd: string) => void;
  activeFileName?: string;
}

// Detect language => file extension and icon
const getLangMeta = (lang: string) => {
  const map: Record<string, { ext: string; icon: React.ReactNode }> = {
    tsx: { ext: 'tsx', icon: <FileCode size={15} /> },
    jsx: { ext: 'jsx', icon: <FileCode size={15} /> },
    ts:  { ext: 'ts',  icon: <FileCode size={15} /> },
    js:  { ext: 'js',  icon: <FileCode size={15} /> },
    css: { ext: 'css', icon: <FileText size={15} /> },
    html:{ ext: 'html',icon: <FileText size={15} /> },
    json:{ ext: 'json',icon: <FileText size={15} /> },
    py:  { ext: 'py',  icon: <FileText size={15} /> },
    sh:  { ext: 'sh',  icon: <FileText size={15} /> },
  };
  return map[lang] ?? { ext: lang || 'txt', icon: <FileText size={15} /> };
};

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ activeProject, activeFileContent, activeFileName, messages, setMessages, onFileSelect, onRunInTerminal }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [models, setModels] = useState<{id: string, name: string}[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('Gemini 1.5 Pro (Elite)');
  const [mode, setMode] = useState<string>('Auto');
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);

  useEffect(() => {
    fetch('/api/models')
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) {
            setModels(data);
            if (data.length > 0) setSelectedModel(data[0].name);
         }
      })
      .catch(console.error);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              messages: newMessages,
              contextMode: activeProject,
              contextCode: activeFileContent,
              contextFile: activeFileName
          })
      });
      
      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('No body in response');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
              if (line.startsWith('data: ')) {
                  const dataStr = line.replace('data: ', '').trim();
                  if (dataStr === '[DONE]') continue;
                  try {
                      const data = JSON.parse(dataStr);
                      if (data.text) {
                          assistantContent += data.text;
                          setMessages(prev => {
                              const last = [...prev];
                              last[last.length - 1].content = assistantContent;
                              return last;
                          });
                      }
                  } catch (e) {}
              }
          }
      }

      // Auto-inject the FIRST detected large code block to Monaco (skip shell blocks)
      const codeBlockRegex2 = /```(\w+)?\n([\s\S]*?)\n```/g;
      let firstMatch = codeBlockRegex2.exec(assistantContent);
      if (firstMatch) {
        const lang = firstMatch[1] || 'txt';
        const code = firstMatch[2];
        const isShell = ['sh', 'bash', 'zsh', 'shell'].includes(lang);
        if (!isShell && (code.split('\n').length > 5 || code.length > 200) && onFileSelect) {
          const { ext } = getLangMeta(lang);
          onFileSelect({ name: `agent_output.${ext}`, content: code });
        }
      }
    } catch (error) {
      console.error("Chat proxy failed:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection error to Studio Proxy. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Render message content — parse code blocks, show artifacts for large ones
  const renderMessageContent = (content: string, msgIndex: number) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let codeCount = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const text = content.substring(lastIndex, match.index);
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">{text}</span>
        );
      }

      const lang = match[1] || 'text';
      const code = match[2];
      const { ext, icon } = getLangMeta(lang);
      const isShell = ['sh', 'bash', 'zsh', 'shell'].includes(lang);
      codeCount++;

      if (code.split('\n').length > 5 || code.length > 200) {
        if (isShell) {
          // Shell block — show as terminal artifact
          parts.push(
            <div
              key={`code-${match.index}`}
              className="my-3 p-3 bg-[#060e14] border border-[#1e3e4a] rounded-xl group hover:border-[var(--solar-green)]/50 transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-[#0a2d38] border border-[#1e3e4a] rounded-lg flex items-center justify-center text-[var(--solar-green)]">
                  <span className="text-[11px] font-bold font-mono">$_</span>
                </div>
                <div>
                  <span className="text-[12px] font-bold text-[var(--text-heading)] tracking-tight">Shell Script</span>
                  <span className="text-[10px] text-[var(--text-muted)] ml-2">{code.split('\n').length} lines · {lang}</span>
                </div>
              </div>
              <pre className="text-[11px] font-mono text-[var(--solar-green)] bg-[#030a0d] rounded-lg p-3 overflow-x-auto whitespace-pre border border-[#1e3e4a]">{code}</pre>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onRunInTerminal?.(code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--solar-green)]/10 hover:bg-[var(--solar-green)]/20 border border-[var(--solar-green)]/30 text-[var(--solar-green)] rounded-lg text-[11px] font-bold transition-colors"
                >
                  <span className="font-mono">$</span> Run in Terminal
                </button>
                <button
                  onClick={() => onFileSelect?.({ name: `script_${msgIndex}_${codeCount}.${ext}`, content: code })}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] hover:border-[var(--solar-cyan)]/40 text-[var(--text-muted)] hover:text-[var(--solar-cyan)] rounded-lg text-[11px] transition-colors"
                >
                  Open in Monaco
                </button>
              </div>
            </div>
          );
        } else {
          // Code block — Monaco artifact card
          parts.push(
            <div
              key={`code-${match.index}`}
              className="my-3 p-3 bg-[#060e14] border border-[#1e3e4a] rounded-xl flex items-center justify-between group hover:border-[var(--solar-cyan)] transition-all cursor-pointer shadow-inner"
              onClick={() => onFileSelect?.({ name: `agent_output_${msgIndex}_${codeCount}.${ext}`, content: code })}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0a2d38] border border-[#1e3e4a] rounded-lg flex items-center justify-center text-[var(--solar-cyan)]">
                  {icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-[var(--text-heading)] tracking-tight">agent_output.{ext}</span>
                  <span className="text-[10px] text-[var(--text-muted)] mt-0.5">{code.split('\n').length} lines &middot; {lang}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--solar-cyan)] opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">Open in Monaco</span>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--solar-cyan)] transition-colors" />
              </div>
            </div>
          );
        }
      } else {
        // Short snippet — inline code block
        parts.push(
          <pre key={`code-${match.index}`} className="my-2 p-3 bg-[#060e14] rounded-lg border border-[#1e3e4a] overflow-x-auto text-[12px] font-mono whitespace-pre text-[var(--solar-cyan)]">
            <code>{code}</code>
          </pre>
        );
      }

      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-end`} className="whitespace-pre-wrap">{content.substring(lastIndex)}</span>
      );
    }

    return parts.length > 0 ? <>{parts}</> : <span className="whitespace-pre-wrap">{content}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] w-full overflow-hidden">
      <style>{`
        .agent-content strong { color: var(--solar-cyan); font-weight: 700; }
        .agent-content h1, .agent-content h2, .agent-content h3 { color: var(--text-heading); font-weight: 700; margin-bottom: 0.75rem; }
        .agent-content ul, .agent-content ol { padding-left: 1.5rem; margin-bottom: 1rem; }
        .agent-content li { margin-bottom: 0.4rem; }
        .agent-content p + p { margin-top: 0.75rem; }
        .chat-hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── MESSAGES AREA (scrolls) ───────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pt-6 pb-4 space-y-6 w-full chat-hide-scroll"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse max-w-[85%]' : 'max-w-full w-full'}`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-[#1e3e4a]' : 'bg-[var(--solar-cyan)]/20 border border-[var(--solar-cyan)]/30'}`}>
                {msg.role === 'user' ? <User size={11} className="text-[var(--text-muted)]" /> : <Bot size={11} className="text-[var(--solar-cyan)]" />}
              </div>

              {/* Bubble */}
              <div className={`agent-content text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#060e14] border border-[#1e3e4a] px-4 py-3 rounded-2xl rounded-tr-sm text-[var(--text-main)]'
                  : 'text-[var(--text-main)] w-full'
              }`}>
                {renderMessageContent(msg.content, i)}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-6 h-6 rounded-md bg-[var(--solar-cyan)]/20 border border-[var(--solar-cyan)]/30 flex items-center justify-center">
                <Loader2 size={11} className="text-[var(--solar-cyan)] animate-spin" />
              </div>
              <div className="px-4 py-3 bg-[#060e14] border border-[#1e3e4a] rounded-2xl rounded-tl-sm">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-[var(--solar-cyan)] rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-[var(--solar-cyan)] rounded-full animate-bounce [animation-delay:0.15s]" />
                  <div className="w-1.5 h-1.5 bg-[var(--solar-cyan)] rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── PREMIUM INPUT FOOTER ────────────────────── */}
      <div className="shrink-0 w-full p-3 bg-[var(--bg-panel)] border-t border-[var(--border-subtle)]">

        {/* Model + Mode selector row */}
        <div className="flex items-center gap-2 mb-2 px-0.5">
          {/* Mode pill */}
          <div className="relative">
            <button
              className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-app)] border border-[#1e3e4a] hover:border-[var(--solar-cyan)]/50 rounded-md text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
              onClick={() => { setIsModeOpen(!isModeOpen); setIsModelOpen(false); }}
            >
              <span className="text-[var(--solar-cyan)]">∞</span> {mode} <ChevronDown size={8} className="opacity-40" />
            </button>
            {isModeOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-[#060e14] border border-[#1e3e4a] rounded-xl shadow-2xl p-1 flex flex-col min-w-[130px] text-[11px] z-[100]">
                {['Auto', 'Agent', 'Plan', 'Debug', 'Research'].map(m => (
                  <button key={m} className={`px-3 py-1.5 text-left hover:bg-[#0a2d38] cursor-pointer rounded-lg flex items-center justify-between transition-colors ${mode === m ? 'text-[var(--solar-cyan)] bg-[#0a2d38]' : 'text-[var(--text-muted)]'}`} onClick={() => { setMode(m); setIsModeOpen(false); }}>
                    {m} {mode === m && <span className="opacity-50 text-[9px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model pill */}
          <div className="relative flex-1 min-w-0">
            <button
              className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-app)] border border-[#1e3e4a] hover:border-[var(--solar-cyan)]/50 rounded-md text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all w-full truncate"
              onClick={() => { setIsModelOpen(!isModelOpen); setIsModeOpen(false); }}
            >
              <Sparkles size={9} className="text-[var(--solar-yellow)] shrink-0" />
              <span className="truncate uppercase tracking-tight">{selectedModel}</span>
              <ChevronDown size={8} className="opacity-40 shrink-0 ml-auto" />
            </button>
            {isModelOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-[#060e14] border border-[#1e3e4a] rounded-xl shadow-2xl flex flex-col min-w-[200px] text-[11px] z-[100] max-h-60 overflow-y-auto">
                <div className="px-3 py-2 text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest border-b border-[#1e3e4a]">Compute</div>
                <div className="p-1 flex flex-col gap-0.5">
                  {models.map(m => (
                    <button key={m.id} className={`px-3 py-1.5 text-left hover:bg-[#0a2d38] cursor-pointer rounded-lg truncate transition-colors ${selectedModel === m.name ? 'text-[var(--solar-cyan)] bg-[#0a2d38]' : 'text-[var(--text-muted)]'}`} onClick={() => { setSelectedModel(m.name); setIsModelOpen(false); }}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input box — premium frosted card */}
        <div className="flex flex-col bg-[#060e14] border border-[#1e3e4a] focus-within:border-[var(--solar-cyan)]/60 rounded-xl transition-all shadow-inner overflow-hidden">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask the Agent anything..."
            rows={1}
            className="w-full bg-transparent px-3.5 pt-3 pb-1 text-[13px] focus:outline-none text-[var(--text-main)] placeholder:text-[#2e5464] resize-none font-sans leading-relaxed"
            style={{ minHeight: '44px', maxHeight: '160px' }}
          />
          {/* Action row below textarea */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--solar-cyan)] hover:bg-white/5 rounded-lg transition-all" title="Attach file">
                <Plus size={14} />
              </button>
              <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--solar-cyan)] hover:bg-white/5 rounded-lg transition-all" title="Voice input">
                <Mic size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#2e5464] font-mono select-none">⏎ send · ⇧⏎ newline</span>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  input.trim() && !isLoading
                    ? 'bg-[var(--solar-cyan)] text-[#00212b] shadow-[0_0_16px_rgba(45,212,191,0.25)] hover:brightness-110 hover:shadow-[0_0_20px_rgba(45,212,191,0.4)]'
                    : 'text-[#2a4d58] bg-[#0a1c22] cursor-not-allowed'
                }`}
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {isLoading ? 'Sending' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

