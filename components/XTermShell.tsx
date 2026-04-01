import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { X, ExternalLink, ChevronDown, ChevronUp, Radio, Wifi, Plus, TriangleAlert, CircleCheck } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { SHELL_VERSION } from '../src/shellVersion';

export type ShellTab = 'terminal' | 'output' | 'problems';

export interface XTermShellHandle {
  writeToTerminal: (text: string) => void;
  runCommand: (cmd: string) => void;
  setActiveTab: (t: ShellTab) => void;
}

interface XTermShellProps {
  onClose: () => void;
  iamOrigin?: string;
  problems?: { file: string; line: number; msg: string; severity: 'error' | 'warning' }[];
  outputLines?: string[];
  onOutputLine?: (line: string) => void;
}

function readCssVar(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || '';
}

const MIN_HEIGHT = 140;
const MAX_HEIGHT_RATIO = 0.75;
const DEFAULT_HEIGHT = 280;

async function execLine(line: string): Promise<{ stdout: string; stderr?: string }> {
  const res = await fetch('/api/shell/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line }),
  });
  if (!res.ok) {
    return { stdout: '', stderr: `HTTP ${res.status}` };
  }
  return (await res.json()) as { stdout: string; stderr?: string };
}

export const XTermShell = forwardRef<XTermShellHandle, XTermShellProps>(
  ({ onClose, iamOrigin = 'https://inneranimalmedia.com', problems = [], outputLines = [], onOutputLine }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const currentLineRef = useRef('');
    const onOutputLineRef = useRef(onOutputLine);
    onOutputLineRef.current = onOutputLine;
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTabState] = useState<ShellTab>('terminal');

    useImperativeHandle(ref, () => ({
      writeToTerminal: (text: string) => {
        if (!xtermRef.current) return;
        setIsCollapsed(false);
        setActiveTabState('terminal');
        xtermRef.current.writeln(`\x1b[2m${text}\x1b[0m`);
        xtermRef.current.write('\x1b[1;32m$\x1b[0m ');
      },
      runCommand: (cmd: string) => {
        void (async () => {
          if (!xtermRef.current) return;
          setIsCollapsed(false);
          setActiveTabState('terminal');
          const term = xtermRef.current;
          term.writeln(`\x1b[1;32m$\x1b[0m \x1b[1m${cmd}\x1b[0m`);
          const { stdout, stderr } = await execLine(cmd);
          if (stdout) term.writeln(stdout);
          if (stderr && !stderr.includes('[clear]')) term.writeln(`\x1b[31m${stderr}\x1b[0m`);
          onOutputLineRef.current?.(`$ ${cmd}\n${stdout || ''}${stderr ? '\n' + stderr : ''}`);
          term.write('\x1b[1;32m$\x1b[0m ');
        })();
      },
      setActiveTab: (t: ShellTab) => {
        setActiveTabState(t);
        setIsCollapsed(false);
      },
    }));

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

    useEffect(() => {
      if (!terminalRef.current || isCollapsed) return;

      const bg = readCssVar('--scene-bg') || readCssVar('--bg-app');
      const fg = readCssVar('--text-main');
      const cyan = readCssVar('--solar-cyan');
      const sel = readCssVar('--bg-panel');
      const red = readCssVar('--solar-red');
      const green = readCssVar('--solar-green');
      const yellow = readCssVar('--solar-yellow');
      const blue = readCssVar('--solar-blue');
      const magenta = readCssVar('--solar-magenta');
      const base03 = readCssVar('--solar-base03');
      const base01 = readCssVar('--solar-base01');

      const term = new Terminal({
        theme: {
          background: bg,
          foreground: fg,
          cursor: cyan,
          selectionBackground: sel,
          black: base03,
          brightBlack: base01,
          red,
          brightRed: readCssVar('--solar-orange'),
          green,
          brightGreen: readCssVar('--solar-base00'),
          yellow,
          brightYellow: base01,
          blue,
          brightBlue: fg,
          magenta,
          brightMagenta: readCssVar('--solar-violet'),
          cyan,
          brightCyan: readCssVar('--solar-base0'),
          white: readCssVar('--solar-base1'),
          brightWhite: readCssVar('--solar-base1'),
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
      term.writeln(`\x1b[1;36m  IAM Lab shell\x1b[0m \x1b[2m— aitestsuite ${SHELL_VERSION} · type help\x1b[0m`);
      term.writeln(`\x1b[2m  R2: r2 ls tools code/ | r2 cat tools <key> | writes under ${'aitestsuite/lab/'}\x1b[0m`);
      term.writeln(`\x1b[2m  Real zsh: inneranimalmedia dashboard terminal (tunnel) or local repo\x1b[0m`);
      term.writeln('');
      term.write('\x1b[1;32m$\x1b[0m ');

      term.onKey(({ key, domEvent }) => {
        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
        if (domEvent.keyCode === 13) {
          const cmd = currentLineRef.current.trim();
          currentLineRef.current = '';
          term.writeln('');
          if (cmd) {
            const low = cmd.toLowerCase();
            if (low === 'clear' || low === 'cls') {
              term.clear();
              term.write('\x1b[1;32m$\x1b[0m ');
              return;
            }
            void (async () => {
              const { stdout, stderr } = await execLine(cmd);
              if (stderr && stderr.includes('[clear]')) {
                term.clear();
              } else {
                if (stdout) term.writeln(stdout);
                if (stderr) term.writeln(`\x1b[31m${stderr}\x1b[0m`);
              }
              onOutputLineRef.current?.(`$ ${cmd}\n${stdout || ''}${stderr && !stderr.includes('[clear]') ? '\n' + stderr : ''}`);
              term.write('\x1b[1;32m$\x1b[0m ');
            })();
          } else {
            term.write('\x1b[1;32m$\x1b[0m ');
          }
        } else if (domEvent.keyCode === 8) {
          if (currentLineRef.current.length > 0) {
            currentLineRef.current = currentLineRef.current.slice(0, -1);
            term.write('\b \b');
          }
        } else if (printable) {
          currentLineRef.current += key;
          term.write(key);
        }
      });

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      const onResize = () => setTimeout(() => fitAddonRef.current?.fit(), 50);
      const ro = new ResizeObserver(() => setTimeout(() => fitAddonRef.current?.fit(), 30));
      if (terminalRef.current) ro.observe(terminalRef.current.parentElement ?? terminalRef.current);
      window.addEventListener('resize', onResize);
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', onResize);
        term.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      };
    }, [isCollapsed]);

    useEffect(() => {
      setTimeout(() => fitAddonRef.current?.fit(), 80);
    }, [height, activeTab]);

    const tabs = ['terminal', 'output', 'problems'] as const;
    const errCount = problems.filter((p) => p.severity === 'error').length;
    const warnCount = problems.filter((p) => p.severity === 'warning').length;

    return (
      <div
        className="flex flex-col flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] z-50 select-none animate-slide-up origin-bottom min-h-0"
        style={{ height: isCollapsed ? 36 : height }}
      >
        {!isCollapsed && (
          <div
            className="w-full h-[5px] flex items-center justify-center cursor-row-resize shrink-0 group hover:bg-[var(--solar-cyan)]/30 transition-colors"
            onMouseDown={handleDragStart}
          >
            <div className="w-12 h-[2px] rounded-full bg-[var(--border-subtle)] group-hover:bg-[var(--solar-cyan)] transition-colors" />
          </div>
        )}

        <div className="h-9 flex items-center justify-between px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] shrink-0">
          <div className="flex items-center gap-0.5 h-full">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setActiveTabState(t);
                  setIsCollapsed(false);
                }}
                className={`h-full px-3 text-[11px] font-semibold uppercase tracking-widest transition-colors relative flex items-center gap-1.5 ${
                  activeTab === t && !isCollapsed
                    ? 'text-[var(--text-main)] border-b-2 border-[var(--solar-cyan)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {t}
                {t === 'problems' && errCount + warnCount > 0 && (
                  <span
                    className={`text-[9px] px-1 py-0.5 rounded font-bold ${errCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}
                  >
                    {errCount > 0 ? errCount : warnCount}
                  </span>
                )}
              </button>
            ))}

            <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

            <button type="button" className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors" title="New Terminal">
              <Plus size={13} />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <a
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-[var(--border-subtle)] hover:text-[var(--solar-cyan)] hover:border-[var(--solar-cyan)]/50 transition-colors"
              title="Prod dashboard terminal (session cookie + tunnel)"
              href={`${iamOrigin}/dashboard/agent`}
              target="_blank"
              rel="noreferrer"
            >
              <Radio size={11} />
              IAM
            </a>
            <span
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest opacity-50 border border-[var(--border-subtle)]"
              title="This panel uses Worker /api/shell/exec (not WS)"
            >
              <Wifi size={11} />
              Lab
            </span>

            <div className="w-px h-4 bg-[var(--border-subtle)]" />

            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-hover)] text-[var(--text-muted)]">lab shell</span>

            <a
              className="p-1 rounded hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Open prod dashboard"
              href={`${iamOrigin}/dashboard/agent`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={13} />
            </a>

            <button
              type="button"
              className="p-1 rounded hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            <button type="button" className="p-1 rounded hover:text-white hover:bg-red-500/20 transition-colors" title="Close" onClick={onClose}>
              <X size={13} />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className={`flex-1 min-h-0 overflow-hidden p-1 ${activeTab !== 'terminal' ? 'hidden' : ''}`} ref={terminalRef} />

            {activeTab === 'output' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed text-[var(--text-muted)] space-y-0.5 custom-scrollbar">
                {outputLines.length === 0 ? (
                  <p className="opacity-50 italic">No output yet. Commands appear here from the Lab shell.</p>
                ) : (
                  outputLines.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'problems' && (
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {problems.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 text-[12px] text-[var(--solar-green)]">
                    <CircleCheck size={14} /> No problems detected.
                  </div>
                ) : (
                  problems.map((p, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-4 py-2 border-b border-[var(--border-subtle)]/50 text-[12px] hover:bg-[var(--bg-hover)] transition-colors ${
                        p.severity === 'error' ? 'text-red-400' : 'text-yellow-400'
                      }`}
                    >
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
          </div>
        )}
      </div>
    );
  }
);

XTermShell.displayName = 'XTermShell';
