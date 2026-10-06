import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { EditOperation, AIResponse } from '../../types/ai';
import { ImageItem, AIStatusInfo } from '../../types/editor';
import { safeFetchJSON } from '../../utils/imageOptimizer';

interface AIAssistantToolProps {
  activeImage: ImageItem;
  aiStatus: AIStatusInfo | null;
  onApplyAIOperations: (operations: EditOperation[], explanation: string) => void;
}

export const AIAssistantTool: React.FC<AIAssistantToolProps> = ({
  activeImage,
  aiStatus,
  onApplyAIOperations,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingResponse, setPendingResponse] = useState<AIResponse | null>(null);

  const exampleChips = [
    'Make it brighter',
    'Make background white',
    'Create passport photo',
    'Make it warmer',
    'Increase sharpness',
    'Resize to 600 × 600',
    'Make this photo black and white',
  ];

  const handleSubmit = async (commandToSubmit?: string) => {
    const text = (commandToSubmit || prompt).trim();
    if (!text || loading) return;

    setLoading(true);
    setError(null);
    setPendingResponse(null);

    try {
      const payload = {
        instruction: text,
        editorState: {
          currentDimensions: {
            width: activeImage.width,
            height: activeImage.height,
          },
          adjustments: {
            brightness: activeImage.adjustments.brightness,
            contrast: activeImage.adjustments.contrast,
            saturation: activeImage.adjustments.saturation,
            exposure: activeImage.adjustments.exposure,
          },
          filter: activeImage.filter,
          background: {
            isTransparent: activeImage.background.isTransparent,
            color: activeImage.background.color,
          },
          border: {
            enabled: activeImage.border.enabled,
            color: activeImage.border.color,
            width: activeImage.border.width,
            radius: activeImage.border.radius,
          },
          rotation: activeImage.transform.rotation,
          isPassportMode: activeImage.passport.active,
        },
      };

      const res = await fetch('/api/ai/photo-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const { ok, data, error: fetchErr } = await safeFetchJSON<AIResponse>(
        res,
        'Failed to process AI assistant instruction.'
      );

      if (!ok || !data) {
        throw new Error(fetchErr || 'Failed to process AI assistant instruction.');
      }

      setPendingResponse(data);
      setPrompt('');
    } catch (err: any) {
      setError(
        err.message ||
          'Unable to connect to the AI service. Local editing remains fully available.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmApply = () => {
    if (!pendingResponse) return;
    onApplyAIOperations(pendingResponse.operations, pendingResponse.explanation);
    setPendingResponse(null);
  };

  const formatOperationName = (op: EditOperation): string => {
    switch (op.type) {
      case 'setBrightness':
        return `Brightness ${op.value > 0 ? `+${op.value}` : op.value}`;
      case 'setContrast':
        return `Contrast ${op.value > 0 ? `+${op.value}` : op.value}`;
      case 'setSaturation':
        return `Saturation ${op.value > 0 ? `+${op.value}` : op.value}`;
      case 'setExposure':
        return `Exposure ${op.value > 0 ? `+${op.value}` : op.value}`;
      case 'setFilter':
        return `Filter "${op.filter}"`;
      case 'crop':
        return `Crop to ${Math.round(op.width)} × ${Math.round(op.height)} px`;
      case 'resize':
        return `Resize to ${op.width} × ${op.height} px`;
      case 'rotate':
        return `Rotate ${op.degrees}°`;
      case 'flipHorizontal':
        return 'Flip Horizontal';
      case 'flipVertical':
        return 'Flip Vertical';
      case 'setBackground':
        return `Set Background Color: ${op.color}`;
      case 'setTransparency':
        return op.enabled ? 'Set Transparent Canvas' : 'Disable Transparency';
      case 'setBorder':
        return op.enabled ? `Border (${op.color || '#fff'}, ${op.width || 4}px)` : 'Remove Border';
      case 'resetAdjustments':
        return 'Reset adjustments to default';
      case 'exportSuggestion':
        return `Suggested Export: ${op.format?.toUpperCase() || 'PNG'} @ ${op.quality || 90}%`;
      case 'unsupported':
        return `Unsupported: ${op.reason}`;
      default:
        return 'Edit operation';
    }
  };

  return (
    <div id="tool-ai-assistant" className="flex flex-col gap-4 text-slate-200">
      <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">ShebaFlow AI</h3>
          </div>
          <p className="text-xs text-slate-400">Describe what you want to change.</p>
        </div>
      </div>

      {/* Production Status Badge */}
      <div className="flex items-center gap-2.5 rounded-xl bg-slate-900/90 border border-slate-800 p-3 text-[11px] text-slate-300 shadow-sm">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            aiStatus?.configured
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
              : 'bg-emerald-400'
          }`}
        />
        <div className="flex flex-col">
          <span className="font-semibold text-white">ShebaFlow AI Engine</span>
          <span className="text-[10px] text-slate-400">
            Natural language photo editing & automated touch-up
          </span>
        </div>
      </div>

      {/* Input box */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-slate-400">What would you like to edit?</label>
        <div className="relative">
          <textarea
            id="ai-command-input"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="e.g. Make this photo brighter and increase contrast slightly..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 resize-none pr-10"
          />
          <button
            id="btn-ai-submit"
            onClick={() => handleSubmit()}
            disabled={loading || !prompt.trim()}
            className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-30 disabled:hover:bg-emerald-400 transition-all"
            title="Send to AI Assistant"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Example Chips */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
          Quick Commands
        </label>
        <div className="flex flex-wrap gap-1.5">
          {exampleChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPrompt(chip);
                handleSubmit(chip);
              }}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/40 hover:bg-slate-850 transition-all text-left"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>AI Assistance Notice</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-300">{error}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">All local tools remain functional.</span>
          </div>
        </div>
      )}

      {/* Structured Suggestions Preview & Confirm */}
      {pendingResponse && (
        <div
          id="ai-suggestions-panel"
          className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/40 shadow-lg shadow-emerald-500/5 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white">AI Suggested Changes</h4>
          </div>

          <p className="text-xs text-slate-300 mb-3 italic">
            "{pendingResponse.explanation}"
          </p>

          <div className="flex flex-col gap-1.5 mb-4">
            {pendingResponse.operations.map((op, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-slate-200 bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{formatOperationName(op)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-apply-ai-changes"
              onClick={handleConfirmApply}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 transition-all shadow-md shadow-emerald-500/20"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Apply Changes</span>
            </button>
            <button
              id="btn-cancel-ai-changes"
              onClick={() => setPendingResponse(null)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
