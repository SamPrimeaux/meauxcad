import React from 'react';
import { GitBranch, XCircle, AlertTriangle, Bell, Check } from 'lucide-react';
import { SHELL_VERSION } from '../src/shellVersion';

interface StatusBarProps {
    branch?: string;
    workspace?: string;
    errorCount?: number;
    warningCount?: number;
    line?: number;
    col?: number;
    activeTab?: string;
    version?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
    branch = 'main*',
    workspace = 'samprimeaux',
    errorCount = 0,
    warningCount = 0,
    line = 10448,
    col = 30,
    activeTab = 'JavaScript',
    version = SHELL_VERSION
}) => {
    return (
        <div className="h-6 bg-[#002b36] border-t border-[var(--border-subtle)]/30 w-full flex items-center justify-between text-[11px] font-mono text-white/80 shrink-0 z-[100] relative">
            {/* Left Box */}
            <div className="flex items-center gap-1 sm:gap-3 h-full px-1">
                <div className="flex items-center gap-1 hover:text-white hover:bg-black/20 cursor-pointer px-2 transition-colors h-full bg-[#2aa198]/20">
                    <span className="font-bold -mt-[1px] tracking-wide">IAM</span>
                </div>
                <div className="flex items-center gap-1 hover:text-white hover:bg-black/20 cursor-pointer px-2 h-full transition-colors">
                    <GitBranch size={12} className="opacity-70" />
                    <span>{branch}</span>
                </div>
                <div className="hidden md:flex items-center hover:text-white hover:bg-black/20 cursor-pointer px-2 h-full transition-colors opacity-75">
                    {workspace}
                </div>
                <div className="flex items-center gap-2 hover:text-white hover:bg-black/20 cursor-pointer px-2 h-full transition-colors">
                    <div className="flex items-center gap-1"><XCircle size={12} className="text-[#dc322f]" /> {errorCount}</div>
                    <div className="flex items-center gap-1"><AlertTriangle size={12} className="text-[#b58900]" /> {warningCount}</div>
                </div>
            </div>

            {/* Right Box - Truncates intelligently */}
            <div className="flex items-center gap-1 sm:gap-2 h-full overflow-hidden">
                <div className="hidden sm:flex items-center hover:text-white hover:bg-black/20 cursor-pointer px-2 h-full transition-colors">
                    Ln {line}, Col {col}
                </div>
                <div className="hidden sm:flex items-center hover:text-white hover:bg-black/20 cursor-pointer px-2 h-full transition-colors">
                    Space: 4
                </div>
                <div className="hidden md:flex items-center hover:text-white hover:bg-black/20 cursor-pointer px-2 h-full transition-colors">
                    UTF-8
                </div>
                <div className="hidden lg:flex items-center hover:text-white hover:bg-black/20 cursor-pointer px-2 h-full transition-colors">
                    LF
                </div>
                <div className="flex items-center hover:text-white hover:bg-black/20 cursor-pointer px-2 h-full transition-colors text-white font-semibold flex-shrink-0">
                    {activeTab}
                </div>
                {version && (
                    <div className="hidden min-[1100px]:flex items-center px-2 h-full bg-[#859900]/20 text-[#859900] font-bold border-x border-[var(--border-subtle)]/20">
                        v{version}
                    </div>
                )}
                <div className="hidden items-center gap-1 hover:text-white cursor-pointer px-1 transition-colors">

                    <div className="flex gap-1 items-center px-1 rounded-sm bg-black/20">
                        <Check size={12} className="text-[#859900]" /> Prettier
                    </div>
                </div>
                <div className="flex items-center justify-center hover:text-white hover:bg-black/20 cursor-pointer px-3 h-full transition-colors">
                    <Bell size={13} className="opacity-70" />
                </div>
            </div>
        </div>
    );
};
