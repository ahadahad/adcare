import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { ImageItem, AIStatusInfo } from '../../types/editor';
import { EditOperation } from '../../types/ai';
import { AIAssistantTool } from '../tools/AIAssistantTool';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeImage: ImageItem | null;
  aiStatus: AIStatusInfo | null;
  onApplyAIOperations: (operations: EditOperation[], explanation: string) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  activeImage,
  aiStatus,
  onApplyAIOperations,
}) => {
  if (!isOpen || !activeImage) return null;

  return (
    <div
      id="ai-assistant-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="ai-assistant-modal-dialog"
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col text-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                AI Studio Assistant
              </h3>
              <p className="text-[11px] text-slate-400">
                Natural language photo transformations & smart operations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[80vh] overflow-y-auto">
          <AIAssistantTool
            activeImage={activeImage}
            aiStatus={aiStatus}
            onApplyAIOperations={(ops, explanation) => {
              onApplyAIOperations(ops, explanation);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
