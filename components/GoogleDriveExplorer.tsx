import React, { useState } from 'react';
import { 
  Cloud, Folder, File, ChevronRight, ChevronDown, 
  Plus, Upload, RefreshCw, MoreVertical, HardDrive, 
  Github, User, Settings, Lock
} from 'lucide-react';

export const GoogleDriveExplorer: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    if (!isAuthenticated) {
        return (
            <div className="w-full h-full bg-[var(--bg-panel)] flex flex-col items-center justify-center p-6 text-center">
                <div className="p-10 bg-[var(--solar-blue)]/5 rounded-full mb-6 border border-dashed border-[var(--solar-blue)]/20 relative">
                  <Cloud size={48} className="text-[var(--solar-blue)] animate-pulse" />
                  <div className="absolute top-0 right-0 bg-[var(--bg-panel)] p-1 rounded-full border border-[var(--border-subtle)]">
                    <Lock size={12} className="text-[var(--text-muted)]" />
                  </div>
                </div>
                <h3 className="text-[14px] font-bold mb-2 uppercase tracking-widest text-[var(--text-heading)]">Cloud Storage Sync</h3>
                <p className="text-[11px] font-mono text-[var(--text-muted)] mb-8 max-w-[200px]">
                  Develop from anywhere. Sync your MeauxCAD workspace with Google Drive for cross-device persistence.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-[220px]">
                  <button 
                    onClick={() => setIsAuthenticated(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--solar-blue)] border border-[var(--solar-blue)] hover:brightness-110 rounded text-[11px] font-bold text-[#00212b] transition-all"
                  >
                    <User size={14} /> Authenticate Google
                  </button>
                  <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-2 overflow-hidden before:flex-1 before:h-[1px] before:bg-[var(--border-subtle)] after:flex-1 after:h-[1px] after:bg-[var(--border-subtle)]">
                    OR
                  </div>
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] hover:border-[var(--solar-cyan)] rounded text-[11px] font-bold transition-all">
                    <Github size={14} /> Link GitHub Repo
                  </button>
                </div>
                <div className="mt-12 p-3 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-left w-full">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--solar-yellow)] mb-1">
                    <Settings size={12} /> Privacy Note
                  </div>
                  <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                    MeauxCAD only requests access to its own folder using the <strong>drive.file</strong> scope. We never see your other files.
                  </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-[var(--bg-panel)] flex flex-col text-[var(--text-main)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Cloud size={14} className="text-[var(--solar-blue)]" />
                    <span className="text-[11px] font-bold tracking-widest uppercase">Google Drive</span>
                </div>
                <div className="flex gap-1">
                    <button className="p-1 hover:bg-[var(--bg-hover)] rounded" title="Refresh"><RefreshCw size={12} /></button>
                    <button className="p-1 hover:bg-[var(--bg-hover)] rounded" title="Upload"><Upload size={12} /></button>
                    <button className="p-1 hover:bg-[var(--bg-hover)] rounded" title="New Folder"><Plus size={12} /></button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-hover)] cursor-pointer rounded group transition-colors"
              >
                {isExpanded ? <ChevronDown size={14} className="text-[var(--text-muted)]" /> : <ChevronRight size={14} className="text-[var(--text-muted)]" />}
                <Folder size={14} className="text-[var(--solar-yellow)]" />
                <span className="text-[12px] font-bold truncate">MeauxCAD_Workshop</span>
                <span className="ml-auto text-[9px] bg-[var(--bg-app)] px-1 rounded opacity-0 group-hover:opacity-100">CLOUD</span>
              </div>

              {isExpanded && (
                <div className="ml-6 mt-1 flex flex-col gap-0.5 border-l border-[var(--border-subtle)] pl-1">
                  <FileItem name="App.tsx" type="file" />
                  <FileItem name="worker.ts" type="file" />
                  <FileItem name="assets" type="folder" />
                  <FileItem name="models" type="folder" />
                </div>
              )}

              <div className="mt-8 border-t border-[var(--border-subtle)]/30 pt-4 px-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">
                  Connected Methods
                </div>
                <div className="flex flex-col gap-2">
                  <StorageMethod name="Local System" icon={<HardDrive size={12}/>} status="Active" />
                  <StorageMethod name="GitHub" icon={<Github size={12}/>} status="Unlinked" />
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-[var(--solar-blue)]/20 flex items-center justify-center shrink-0">
                  <User size={12} className="text-[var(--solar-blue)]" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[11px] font-bold truncate leading-none">Sam Primeaux</span>
                  <span className="text-[9px] text-[var(--text-muted)] truncate">sam@inneranimal.media</span>
                </div>
              </div>
              <button onClick={() => setIsAuthenticated(false)} className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-muted)]" title="Sign Out">
                <Settings size={14} />
              </button>
            </div>
        </div>
    );
};

const FileItem = ({ name, type }: { name: string, type: 'file' | 'folder' }) => (
  <div className="flex items-center gap-2 px-2 py-1 hover:bg-[var(--bg-hover)] cursor-pointer rounded text-[11px] transition-all group">
    {type === 'folder' ? <Folder size={12} className="text-[var(--solar-blue)]" /> : <File size={12} className="text-[var(--text-muted)]" />}
    <span className="truncate">{name}</span>
    <MoreVertical size={10} className="ml-auto opacity-0 group-hover:opacity-40" />
  </div>
);

const StorageMethod = ({ name, icon, status }: { name: string, icon: React.ReactNode, status: string }) => (
  <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[var(--bg-hover)] cursor-pointer transition-all">
    <div className="flex items-center gap-2">
      <div className="text-[var(--text-muted)]">{icon}</div>
      <span className="text-[11px] font-medium">{name}</span>
    </div>
    <span className={`text-[9px] px-1 rounded uppercase font-black ${status === 'Active' ? 'bg-[var(--solar-green)]/10 text-[var(--solar-green)]' : 'bg-[var(--bg-app)] text-[var(--text-muted)]'}`}>{status}</span>
  </div>
);
