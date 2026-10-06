import React from 'react';
import {
  Sparkles,
  Scissors,
  Eraser,
  Smile,
  Zap,
  Clock,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';

export const FutureLabsTool: React.FC = () => {
  const upcomingFeatures = [
    {
      name: 'AI Background Removal',
      description: 'One-click neural background segmentation and cutout',
      icon: Scissors,
      status: 'Coming Soon',
    },
    {
      name: 'AI Background Replacement',
      description: 'Generative environment replacement with realistic shadows',
      icon: Layers,
      status: 'Coming Soon',
    },
    {
      name: 'Object Removal / Magic Eraser',
      description: 'Brush away unwanted powerlines, blemishes, and photobombers',
      icon: Eraser,
      status: 'Coming Soon',
    },
    {
      name: 'Face Enhancement & Skin Retouching',
      description: 'Subtle smoothing and studio portrait lighting enhancement',
      icon: Smile,
      status: 'Coming Soon',
    },
    {
      name: 'Super Resolution (4× Upscale)',
      description: 'Deep-learning detail hallucination for high-res printing',
      icon: Zap,
      status: 'Coming Soon',
    },
    {
      name: 'Old Photo Restoration',
      description: 'Scratch removal and automatic vintage color revitalization',
      icon: Clock,
      status: 'Coming Soon',
    },
  ];

  return (
    <div id="tool-future-labs" className="flex flex-col gap-4 text-slate-200">
      <div className="pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <h3 className="text-sm font-semibold text-white">AI Vision Labs</h3>
        </div>
        <p className="text-xs text-slate-400">Neural image models & computer vision pipelines</p>
      </div>

      <div className="p-3 rounded-xl bg-slate-900 border border-teal-500/20 text-xs text-slate-300">
        <p className="leading-relaxed">
          AI image processing is not connected yet. ShebaFlow's local canvas engine is prepared for
          future backend neural inference endpoints.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {upcomingFeatures.map((f, idx) => {
          const Icon = f.icon;
          return (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">{f.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-mono">
                    {f.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{f.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
