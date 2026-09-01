import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { soundFxService } from '../services/soundFxService.js';

export function TacticalDropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Seleccionar...',
  icon: IconComponent,
  maxHeight = '180px',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Scroll selected item into view on open
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector('.tactical-option.selected');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen]);

  const handleToggle = (e) => {
    e.stopPropagation();
    soundFxService.playClick();
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (val, e) => {
    e.stopPropagation();
    soundFxService.playClick();
    onChange?.(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className={`tactical-dropdown-container ${isOpen ? 'open' : ''} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className="tactical-dropdown-trigger"
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <div className="tactical-dropdown-label-group">
          {IconComponent && <IconComponent size={12} className="tactical-dropdown-icon" />}
          <span className="tactical-dropdown-text">
            {selectedOption?.label || selectedOption?.name || placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="tactical-option-badge mini">{selectedOption.badge}</span>
          )}
        </div>
        <ChevronDown
          size={12}
          className={`tactical-chevron ${isOpen ? 'rotate' : ''}`}
        />
      </button>

      {/* Futuristic Obsidian Popup List */}
      {isOpen && (
        <div
          ref={listRef}
          className="tactical-dropdown-menu"
          style={{ maxHeight }}
          role="listbox"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                className={`tactical-option ${isSelected ? 'selected' : ''}`}
                onClick={(e) => handleSelect(opt.value, e)}
                role="option"
                aria-selected={isSelected}
              >
                <div className="tactical-option-left">
                  <span className="tactical-option-dot" />
                  <div className="tactical-option-info">
                    <span className="tactical-option-title">{opt.label || opt.name}</span>
                    {opt.subtitle && (
                      <span className="tactical-option-sub">{opt.subtitle}</span>
                    )}
                  </div>
                </div>

                <div className="tactical-option-right">
                  {opt.badge && (
                    <span className="tactical-option-badge">{opt.badge}</span>
                  )}
                  {isSelected && <Check size={11} className="tactical-check" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TacticalDropdown;
