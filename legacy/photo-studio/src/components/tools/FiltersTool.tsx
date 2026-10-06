import React from 'react';
import { Check } from 'lucide-react';
import { FilterType } from '../../types/editor';
import { FILTERS } from '../../utils/filters';

interface FiltersToolProps {
  currentFilter: FilterType;
  thumbnailUrl?: string;
  onSelectFilter: (filter: FilterType) => void;
}

export const FiltersTool: React.FC<FiltersToolProps> = ({
  currentFilter,
  thumbnailUrl,
  onSelectFilter,
}) => {
  return (
    <div id="tool-filters" className="flex flex-col gap-4 text-slate-200">
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Color Filters</h3>
        <p className="text-xs text-slate-400">Curated cinematic and artistic color grading</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {FILTERS.map((f) => {
          const isSelected = currentFilter === f.id;
          return (
            <button
              key={f.id}
              id={`filter-btn-${f.id}`}
              onClick={() => onSelectFilter(f.id)}
              className={`group flex flex-col p-2 rounded-xl border text-left transition-all relative overflow-hidden ${
                isSelected
                  ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
              }`}
            >
              {/* Filter Thumbnail preview */}
              <div className="w-full h-16 rounded-lg bg-slate-950 overflow-hidden mb-2 relative border border-slate-800">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={f.name}
                    style={{ filter: f.cssFilter }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-xs font-semibold text-white/90"
                    style={{ backgroundColor: f.previewColor, filter: f.cssFilter }}
                  >
                    {f.name}
                  </div>
                )}

                {isSelected && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">
                {f.name}
              </div>
              <div className="text-[10px] text-slate-400 line-clamp-1">{f.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
