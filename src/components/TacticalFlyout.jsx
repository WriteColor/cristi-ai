import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { soundFxService } from '../services/soundFxService.js';

export const TacticalFlyout = React.memo(function TacticalFlyout({ icon: Icon, title, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector('.shadcn-flyout-option.selected');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen]);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative group" ref={containerRef} onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <button className="w-full flex items-center gap-2 px-2.5 py-2 text-zinc-300 text-[13px] cursor-pointer transition-colors text-left hover:bg-zinc-800 hover:text-white justify-between" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={14} className="shrink-0" />}
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <span className="truncate max-w-[80px] text-xs">{selected?.label}</span>
          <ChevronRight size={14} className="shrink-0" />
        </div>
      </button>
      
      {isOpen && (
        <div className="absolute left-full -top-5 w-[320px] bg-zinc-950 border border-zinc-800 shadow-[0_10px_40px_rgba(0,0,0,0.9)] flex flex-col z-[100000]">
          <div className="px-3 py-2.5 border-b border-zinc-800 font-bold text-[13px] bg-zinc-900">{title}</div>
          <div className="max-h-[350px] overflow-y-auto p-1.5 flex flex-col gap-1 scrollbar-thin scrollbar-thumb-zinc-700" ref={listRef}>
            {options.map(opt => {
              const isSelected = opt.value === value;
              return (
                <div key={opt.value} className={`shadcn-flyout-option ${isSelected ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); soundFxService.playClick(); onChange?.(opt.value); setIsOpen(false); }}>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center w-full">
                      <span className="font-medium text-sm">{opt.label}</span>
                      {opt.badge && <span className="bg-transparent text-zinc-300 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">{opt.badge}</span>}
                    </div>
                    {opt.desc && <span className="text-xs text-muted mt-1 block truncate">{opt.desc}</span>}
                  </div>
                  {isSelected && <Check size={14} className="ml-2 text-primary" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
export default TacticalFlyout;
