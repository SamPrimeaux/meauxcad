import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { X, ExternalLink, ChevronDown, ChevronUp, Radio, Wifi, Plus, TriangleAlert, CircleCheck } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

// ── Public handle the parent can hold via ref ────────────────────────────────
export interface XTermShellHandle {
  /** Write a line of text into the terminal (printed, not executed) */
  writeToTerminal: (text: string) => void;
  /** Write a command and simulate it being run */
  runCommand: (cmd: string) => void;
}

interface XTermShellProps {
  onClose: () => void;
  problems?: { file: string; line: number; msg: string; severity: 'error' | 'warning' }[];
  outputLines?: string[];
}

const MIN_HEIGHT = 140;
const MAX_HEIGHT_RATIO = 0.75;
const DEFAULT_HEIGHT = 280;

export const XTermShell = forwardRef<XTermShellHandle, XTermShellProps>(
  ({ onClose, problems = [], outputLines = [] }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<'terminal' | 'output' | 'problems'>('terminal');

    // ── Expose write / run methods to parent via ref ────────────────────────
    useImperativeHandle(ref, () => ({
      writeToTerminal: (text: string) => {
        if (!xtermRef.current) return;
        setIsCollapsed(false);
        setActiveTab('terminal');
        xtermRef.current.writeln(`\x1b[2m${text}\x1b[0m`);
        xtermRef.current.write('\x1b[1;32m$\x1b[0m ');
      },
      runCommand: (cmd: string) => {
        if (!xtermRef.current) return;
        setIsCollapsed(false);
        setActiveTab('terminal');
        xtermRef.current.writeln(`\x1b[1;32m$\x1b[0m \x1b[1m${cmd}\x1b[0m`);
        xtermRef.current.writeln(`\x1b[2m[Command queued — connect a shell via Tunnel to execute]\x1b[0m`);
        xtermRef.current.write('\x1b[1;32m$\x1b[0m ');
      },
    }));

    // ── Drag handle ─────────────────────────────────────────────────────────
    const handleDragStart = (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;
      const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
      const onMove = (me: MouseEvent) => {
        const delta = startY - me.clientY;
        const next = Math.max(MIN_HEIGHT, Math.min(startHeight + delta, maxH));
        setHeight(next);
        setTimeout(() => fitAddonRef.current?.fit(), 30);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    // ── XTerm init ──────────────────────────────────────────────────────────
    useEffect(() => {
      if (!terminalRef.current || isCollapsed || activeTab !== 'terminal') return;

      const styles = getComputedStyle(document.documentElement);
      const bg   = styles.getPropertyValue('--scene-bg').trim()  || '#060e14';
      const fg   = styles.getPropertyValue('--text-main').trim() || '#839496';
      const cyan = styles.getPropertyValue('--solar-cyan').trim()|| '#2dd4bf';
      const sel  = styles.getPropertyValue('--bg-panel').trim()  || '#0a2d38';

      const term = new Terminal({
        theme: {
          background: bg,
          foreground: fg,
          cursor: cyan,
          selectionBackground: sel,
          black: '#002b36',   brightBlack: '#657b83',
          red: '#dc322f',     brightRed: '#cb4b16',
          green: '#859900',   brightGreen: '#586e75',
          yellow: '#b58900',  brightYellow: '#657b83',
          blue: '#268bd2',    brightBlue: '#839496',
          magenta: '#d33682', brightMagenta: '#6c71c4',
          cyan: '#2aa198',    brightCyan: '#93a1a1',
          white: '#eee8d5',   brightWhite: '#fdf6e3',
        },
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.5,
        cursorBlink: true,
        cursorStyle: 'block',
        allowTransparency: true,
        letterSpacing: 0,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      setTimeout(() => fitAddon.fit(), 50);

      term.writeln('');
      term.writeln('\x1b[1;36m  MeauxCAD Terminal\x1b[0m \x1b[2m— v1 · session active\x1b[0m');
      term.writeln('\x1b[2m  Connect a tunnel to execute real shell commands\x1b[0m');
      term.writeln('');
      term.write('\x1b[1;32m$\x1b[0m ');

      let currentLine = '';
      term.onKey(({ key, domEvent }) => {
        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
        if (domEvent.keyCode === 13) { // Enter
          const cmd = currentLine.trim();
          currentLine = '';
          term.writeln('');
          if (cmd) {
            term.writeln(`\x1b[2m[${cmd}] — local echo only. Tunnel required for real execution.\x1b[0m`);
          }
          term.write('\x1b[1;32m$\x1b[0m ');
        } else if (domEvent.keyCode === 8) { // Backspace
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            term.write('\b \b');
          }
        } else if (printable) {
          currentLine += key;
          term.write(key);
        }
      });

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      const onResize = () => setTimeout(() => fitAddonRef.current?.fit(), 50);
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        term.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      };
    }, [isCollapsed, activeTab]);

    // Re-fit when height changes
    useEffect(() => {
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    }, [height]);

    const tabs = ['terminal', 'output', 'problems'] as const;
    const errCount = problems.filter(p => p.severity === 'error').length;
    const warnCount = problems.filter(p => p.severity === 'warning').length;

    return (
      <div
        className="flex flex-col border-t border-[var(--border-subtle)] bg-[var(--bg-app)] z-50 select-none"
        style={{ height: isCollapsed ? 36 : height, flexShrink: 0 }}
      >
        {/* ── Drag Handle Strip ── */}
        {!isCollapsed && (
          <div
            className="w-full h-[5px] flex items-center justify-center cursor-row-resize shrink-0 group hover:bg-[var(--solar-cyan)]/30 transition-colors"
            onMouseDown={handleDragStart}
          >
            <div className="w-12 h-[2px] rounded-full bg-[var(--border-subtle)] group-hover:bg-[var(--solar-cyan)] transition-colors" />
          </div>
        )}

        {/* ── Header Tab Bar ── */}
        <div className="h-9 flex items-center justify-between px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 h-full">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => { setActiveTab(t); setIsCollapsed(false); }}
                className={`h-full px-3 text-[11px] font-semibold uppercase tracking-widest transition-colors relative flex items-center gap-1.5 ${
                  activeTab === t && !isCollapsed
                    ? 'text-[var(--text-main)] border-b-2 border-[var(--solar-cyan)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {t}
                {t === 'problems' && (errCount + warnCount) > 0 && (
                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${errCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {errCount > 0 ? errCount : warnCount}
                  </span>
                )}
              </button>
            ))}

            <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

            <button
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
              title="New Terminal"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <button
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest opacity-40 cursor-not-allowed border border-[var(--border-subtle)] hover:opacity-60 transition-opacity"
              title="Tunnel (coming soon)"
              disabled
            >
              <Radio size={11} />
              Tunnel
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest opacity-40 cursor-not-allowed border border-[var(--border-subtle)] hover:opacity-60 transition-opacity"
              title="WebSocket (coming soon)"
              disabled
            >
              <Wifi size={11} />
              WS
            </button>

            <div className="w-px h-4 bg-[var(--border-subtle)]" />

            <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-hover)] hover:text-[var(--text-main)] transition-colors">
              zsh <ChevronDown size={10} />
            </button>

            <button
              className="p-1 rounded hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Open in new tab"
            >
              <ExternalLink size={13} />
            </button>

            <button
              className="p-1 rounded hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            <button
              className="p-1 rounded hover:text-white hover:bg-red-500/20 transition-colors"
              title="Close"
              onClick={onClose}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── Content Area ── */}
        {!isCollapsed && (
          <>
            {/* Terminal Tab */}
            {activeTab === 'terminal' && (
              <div className="flex-1 overflow-hidden p-1" ref={terminalRef} />
            )}

            {/* Output Tab */}
            {activeTab === 'output' && (
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed text-[var(--text-muted)] space-y-0.5 custom-scrollbar">
                {outputLines.length === 0 ? (
                  <p className="opacity-50 italic">No output yet.</p>
                ) : (
                  outputLines.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap">{line}</div>
                  ))
                )}
              </div>
            )}

            {/* Problems Tab */}
            {activeTab === 'problems' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {problems.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 text-[12px] text-[var(--solar-green)]">
                    <CircleCheck size={14} /> No problems detected.
                  </div>
                ) : (
                  problems.map((p, i) => (
                    <div key={i} className={`flex items-start gap-3 px-4 py-2 border-b border-[var(--border-subtle)]/50 text-[12px] hover:bg-[var(--bg-hover)] transition-colors ${p.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                      <div>
                        <span className="font-mono text-[var(--text-main)]">{p.file}</span>
                        <span className="text-[var(--text-muted)] ml-1.5">:{p.line}</span>
                        <span className="ml-3">{p.msg}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

XTermShell.displayName = 'XTermShell';
