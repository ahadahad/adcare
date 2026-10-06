import React, { useRef, useState } from 'react';
import { Save, Download, Upload, X, Check, FileCode, HardDrive } from 'lucide-react';
import { ImageItem } from '../../types/editor';

interface ProjectModalProps {
  activeImage: ImageItem;
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: any) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'error') => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  activeImage,
  isOpen,
  onClose,
  onLoadProject,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveName, setSaveName] = useState(activeImage.name.replace(/\.[^/.]+$/, ''));

  if (!isOpen) return null;

  const handleSaveToBrowser = () => {
    try {
      const projectData = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        name: saveName,
        adjustments: activeImage.adjustments,
        filter: activeImage.filter,
        background: activeImage.background,
        border: activeImage.border,
        transform: activeImage.transform,
        passport: activeImage.passport,
        width: activeImage.width,
        height: activeImage.height,
      };
      localStorage.setItem('shebaflow_project_recent', JSON.stringify(projectData));
      onShowToast('Project Saved Locally', 'Preferences saved to browser storage.', 'success');
      onClose();
    } catch (e: any) {
      onShowToast('Save Failed', e.message, 'error');
    }
  };

  const handleDownloadProjectFile = () => {
    try {
      const fullProject = {
        app: 'ShebaFlow Photo Studio',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        name: saveName,
        imageMetadata: {
          name: activeImage.name,
          width: activeImage.width,
          height: activeImage.height,
          originalWidth: activeImage.originalWidth,
          originalHeight: activeImage.originalHeight,
        },
        pipeline: {
          adjustments: activeImage.adjustments,
          filter: activeImage.filter,
          background: activeImage.background,
          border: activeImage.border,
          transform: activeImage.transform,
          passport: activeImage.passport,
        },
        imageDataUrl: activeImage.currentUrl,
      };

      const jsonString = JSON.stringify(fullProject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${saveName || 'project'}.shebaflow`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      onShowToast('Project Exported', `Saved as ${saveName}.shebaflow`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast('Export Error', err.message, 'error');
    }
  };

  const handleUploadProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!json.pipeline && !json.adjustments) {
          throw new Error('Unrecognized ShebaFlow project file format.');
        }
        onLoadProject(json);
        onShowToast('Project Restored', 'Loaded editing pipeline.', 'success');
        onClose();
      } catch (err: any) {
        onShowToast('Failed to Load Project', err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="project-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="project-modal-dialog"
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 flex flex-col gap-5 text-slate-200"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Save className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Save / Load Project</h3>
              <p className="text-xs text-slate-400">Preserve all editing adjustments & pipeline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Project Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Project Name</label>
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>

        {/* Save Options */}
        <div className="grid grid-cols-1 gap-2.5">
          {/* Download .shebaflow project file */}
          <button
            id="btn-download-project-file"
            onClick={handleDownloadProjectFile}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-emerald-500/50 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-emerald-300">
                Download .shebaflow Project File
              </div>
              <div className="text-[11px] text-slate-400">
                Contains full image + editing adjustments file
              </div>
            </div>
          </button>

          {/* Save to LocalStorage */}
          <button
            id="btn-save-browser-storage"
            onClick={handleSaveToBrowser}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-emerald-500/50 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-cyan-300">
                Save to Browser Storage
              </div>
              <div className="text-[11px] text-slate-400">
                Quick local storage for current session
              </div>
            </div>
          </button>

          {/* Import Project */}
          <button
            id="btn-import-project-file"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-slate-700 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-indigo-300">
                Load .shebaflow Project
              </div>
              <div className="text-[11px] text-slate-400">Restore from previously exported file</div>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".shebaflow,.json"
            className="hidden"
            onChange={handleUploadProjectFile}
          />
        </div>
      </div>
    </div>
  );
};
