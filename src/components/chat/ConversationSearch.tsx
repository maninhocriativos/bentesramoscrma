import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';

interface ConversationSearchProps {
  open: boolean;
  onClose: () => void;
  messages: { id: string; conteudo: string }[];
  onHighlight: (messageId: string | null, matchIndex: number, total: number) => void;
  isDark: boolean;
  themeClasses: any;
}

export function ConversationSearch({
  open,
  onClose,
  messages,
  onHighlight,
  isDark,
  themeClasses,
}: ConversationSearchProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setMatches([]);
      onHighlight(null, 0, 0);
    }
  }, [open]);

  const doSearch = useCallback((term: string) => {
    if (!term.trim()) {
      setMatches([]);
      onHighlight(null, 0, 0);
      return;
    }
    const lower = term.toLowerCase();
    const found = messages
      .filter(m => m.conteudo?.toLowerCase().includes(lower))
      .map(m => m.id);
    setMatches(found);
    setCurrentIndex(0);
    if (found.length > 0) {
      onHighlight(found[0], 0, found.length);
    } else {
      onHighlight(null, 0, 0);
    }
  }, [messages, onHighlight]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const goNext = () => {
    if (matches.length === 0) return;
    const next = (currentIndex + 1) % matches.length;
    setCurrentIndex(next);
    onHighlight(matches[next], next, matches.length);
  };

  const goPrev = () => {
    if (matches.length === 0) return;
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prev);
    onHighlight(matches[prev], prev, matches.length);
  };

  if (!open) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDark ? 'bg-[#1F2C34] border-[#313D45]' : 'bg-[#F0F2F5] border-[#E9EDEF]'}`}>
      <Search className={`h-4 w-4 shrink-0 ${themeClasses.secondaryText}`} />
      <Input
        ref={inputRef}
        placeholder="Pesquisar na conversa..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') goNext();
          if (e.key === 'Escape') onClose();
        }}
        className={`h-8 flex-1 border-0 text-sm focus-visible:ring-0 ${isDark ? 'bg-[#2A3942] text-white placeholder:text-gray-400' : 'bg-white text-gray-900'}`}
      />
      {matches.length > 0 && (
        <span className={`text-xs shrink-0 ${themeClasses.secondaryText}`}>
          {currentIndex + 1}/{matches.length}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={goPrev}
          disabled={matches.length === 0}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={goNext}
          disabled={matches.length === 0}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
