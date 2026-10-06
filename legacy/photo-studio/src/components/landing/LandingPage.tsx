import React, { useRef } from 'react';
import {
  Upload,
  Sparkles,
  Crop,
  ShieldCheck,
  Zap,
  Sliders,
  FileImage,
  ArrowRight,
  Layers,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import { generateSampleImages, SampleImageMeta } from '../../utils/sampleImages';

interface LandingPageProps {
  onStartEditing: () => void;
  onOpenPassportMode: () => void;
  onFilesSelected: (files: FileList | File[]) => void;
  onSelectSampleImage: (sample: SampleImageMeta) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartEditing,
  onOpenPassportMode,
  onFilesSelected,
  onSelectSampleImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sampleImages = generateSampleImages();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div id="shebaflow-landing" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-800/80 px-6 sm:px-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Layers className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white">ShebaFlow</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
              Photo Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenPassportMode}
            className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors"
          >
            Passport Photo
          </button>
          <button
            id="btn-landing-top-start"
            onClick={onStartEditing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <span>Open Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-medium mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Browser-Native HTML5 Canvas + TokenHarbor AI</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-5 leading-tight">
            Professional Photo Editing,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Simplified.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Edit, resize, crop, and prepare your photos in one powerful workspace. Ultra-fast local
            canvas processing with structured AI assistance and zero cloud lock-in.
          </p>
        </div>

        {/* Upload & Dropzone Card */}
        <div
          id="landing-dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-2xl p-8 sm:p-10 rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-emerald-500/70 bg-slate-900/60 hover:bg-slate-900/90 transition-all cursor-pointer flex flex-col items-center text-center group shadow-xl mb-10"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onFilesSelected(e.target.files);
              }
            }}
          />

          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-white mb-1">Start editing your photo</h3>
          <p className="text-sm text-slate-400 mb-4">
            Drag & drop an image here, or{' '}
            <span className="text-emerald-400 underline underline-offset-4">
              choose a file from your device
            </span>
          </p>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50">
              JPG
            </span>
            <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50">
              PNG
            </span>
            <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50">
              WebP
            </span>
            <span>• Max 25MB</span>
          </div>
        </div>

        {/* Quick Sample Photos Bar */}
        <div className="w-full max-w-2xl mb-12">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Or test with sample photos
            </span>
            <span className="text-xs text-slate-400">1-click instant load</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sampleImages.map((sample, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSampleImage(sample);
                }}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-850 hover:border-emerald-500/50 transition-all text-left group"
              >
                <img
                  src={sample.dataUrl}
                  alt={sample.name}
                  className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-emerald-300">
                    {sample.category}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {sample.width} × {sample.height} px
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Fast Local Canvas</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Crop, rotate, resize, filters, and color adjustments run 100% inside your browser
              with zero latency.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">AI Assistant (TokenHarbor)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Translate natural language into safe structured JSON instructions with preview and
              confirm workflow.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
              <Camera className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Passport Photo Studio</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Official US 2x2, UK/EU 35x45mm, head position guides, eye level lines, and background
              options.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Privacy Focused</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your photos stay on your device. Zero remote storage of your pictures without your
              permission.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-900 px-6 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <span>© ShebaFlow Photo Studio. Professional Photo Editing Made Simple.</span>
        <div className="flex items-center gap-4">
          <span>HTML5 Canvas Engine</span>
          <span>TokenHarbor gpt-5.6-luna</span>
        </div>
      </footer>
    </div>
  );
};
