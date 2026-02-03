'use client';

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: string[];
};

function fuzzyMatch(search: string, text: string): boolean {
  if (!search.trim()) return true;
  
  const searchLower = search.toLowerCase();
  const textLower = text.toLowerCase();
  
  let searchIndex = 0;
  let textIndex = 0;
  
  while (searchIndex < searchLower.length && textIndex < textLower.length) {
    if (searchLower[searchIndex] === textLower[textIndex]) {
      searchIndex++;
    }
    textIndex++;
  }
  
  return searchIndex === searchLower.length;
}

function findMatchingIndices(search: string, text: string): number[] {
  if (!search.trim()) return [];
  
  const searchLower = search.toLowerCase();
  const textLower = text.toLowerCase();
  
  const indices: number[] = [];
  let searchIndex = 0;
  
  for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
    if (searchLower[searchIndex] === textLower[i]) {
      indices.push(i);
      searchIndex++;
    }
  }
  
  return indices;
}

type DropdownContentProps = {
  options: string[];
  search: string;
  onSelect: (option: string) => void;
};

function DropdownContent({ options, search, onSelect }: DropdownContentProps) {
  const highlightMatch = (text: string, search: string): string => {
    if (!search.trim()) return text;
    
    const indices = findMatchingIndices(search, text);
    if (indices.length === 0) return text;
    
    let result = '';
    let lastIndex = 0;
    
    indices.forEach((index) => {
      result += text.slice(lastIndex, index);
      result += `<mark>${text[index]}</mark>`;
      lastIndex = index + 1;
    });
    
    result += text.slice(lastIndex);
    return result;
  };

  return (
    <div className="max-h-60 w-full overflow-auto rounded-2xl border border-[color:var(--line)] bg-white/95 p-2 shadow-lg backdrop-blur">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--ink)] transition hover:bg-[color:var(--paper-2)] focus:bg-[color:var(--paper-2)] focus:outline-none"
          dangerouslySetInnerHTML={{
            __html: highlightMatch(option, search),
          }}
        />
      ))}
    </div>
  );
}

export default function SearchableSelect({
  value,
  onChange,
  placeholder,
  options,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    return options.filter((opt) => fuzzyMatch(search, opt));
  }, [options, search]);

  const handleSelect = (option: string) => {
    onChange(option);
    setSearch(option);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setIsOpen(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as Node;
    if (!containerRef.current?.contains(relatedTarget)) {
      setIsOpen(false);
      setSearch(value);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 pr-10 text-sm text-[color:var(--ink)] shadow-sm transition placeholder:text-[color:color-mix(in_oklab,var(--muted)_80%,transparent)] hover:bg-white focus:bg-white"
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[color:var(--paper-2)] p-1 text-[color:var(--muted)] transition hover:bg-[color:var(--paper-3)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && dropdownPosition && filteredOptions.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: dropdownPosition?.top,
            left: dropdownPosition?.left,
            width: dropdownPosition?.width,
            zIndex: 9999,
          }}
        >
          <DropdownContent options={filteredOptions} search={search} onSelect={handleSelect} />
        </div>
      )}

      {isOpen && dropdownPosition && filteredOptions.length === 0 && search.trim() && (
        <div
          className="w-full rounded-2xl border border-[color:var(--line)] bg-white/95 p-4 text-center text-sm text-[color:var(--muted)] shadow-lg backdrop-blur"
          style={{
            position: 'fixed',
            top: dropdownPosition?.top,
            left: dropdownPosition?.left,
            width: dropdownPosition?.width,
            zIndex: 9999,
          }}
        >
          Ingen resultater fundet
        </div>
      )}
    </div>
  );
}
