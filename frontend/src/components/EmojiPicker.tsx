import React, { useState, useEffect } from 'react';
import { Search, Clock, Smile, Sparkles, Heart, HelpCircle, Briefcase, CheckCircle, X } from 'lucide-react';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiItem {
  emoji: string;
  name: string;
  category: 'SMILEYS' | 'REACTIONS' | 'PEOPLE' | 'IDEAS' | 'STATUS' | 'FUN';
}

const EMOJI_DATA: EmojiItem[] = [
  { emoji: '😀', name: 'happy smiley grin laugh', category: 'SMILEYS' },
  { emoji: '😃', name: 'smile happy laugh', category: 'SMILEYS' },
  { emoji: '😄', name: 'laugh happy smile', category: 'SMILEYS' },
  { emoji: '😂', name: 'tears joy cry laugh', category: 'SMILEYS' },
  { emoji: '😊', name: 'happy blush smile', category: 'SMILEYS' },
  { emoji: '😍', name: 'love heart eyes smile', category: 'SMILEYS' },
  { emoji: '😎', name: 'cool sunglasses smile', category: 'SMILEYS' },
  { emoji: '🤔', name: 'think wonder ponder query', category: 'SMILEYS' },
  { emoji: '😭', name: 'cry sob sad tears pain', category: 'SMILEYS' },
  // REACTIONS
  { emoji: '👍', name: 'thumbs up thumbsup agree yes like ok', category: 'REACTIONS' },
  { emoji: '👎', name: 'thumbs down thumbsdown disagree no dislike reject', category: 'REACTIONS' },
  { emoji: '❤️', name: 'heart love red passion', category: 'REACTIONS' },
  { emoji: '🔥', name: 'fire hot lit burn energy peak', category: 'REACTIONS' },
  { emoji: '👏', name: 'clap applaud well done congrats clap hands', category: 'REACTIONS' },
  { emoji: '🎉', name: 'party celebrate horn confetti fun celebrate', category: 'REACTIONS' },
  { emoji: '💯', name: 'hundred score perfect A+', category: 'REACTIONS' },
  { emoji: '⭐', name: 'star gold favorite rating', category: 'REACTIONS' },
  // PEOPLE
  { emoji: '👋', name: 'wave hello hi goodbye greeting', category: 'PEOPLE' },
  { emoji: '🙌', name: 'hooray celebrate highfive hands raised', category: 'PEOPLE' },
  { emoji: '🤝', name: 'shake handshake agree deal partner handshake', category: 'PEOPLE' },
  { emoji: '💪', name: 'muscle flex strong power gym fitness', category: 'PEOPLE' },
  { emoji: '✌️', name: 'victory peace sign double peace', category: 'PEOPLE' },
  { emoji: '👀', name: 'eyes look see check watch observation', category: 'PEOPLE' },
  { emoji: '🙏', name: 'pray hands please thank you thanks pray', category: 'PEOPLE' },
  // IDEAS / WORK
  { emoji: '💡', name: 'idea bulb light solution inspiration creative insight', category: 'IDEAS' },
  { emoji: '🚀', name: 'rocket launch startup speed fast deploy scale', category: 'IDEAS' },
  { emoji: '🎯', name: 'target goal focus hit bulls-eye accuracy object target', category: 'IDEAS' },
  { emoji: '🧠', name: 'brain mind think knowledge smart intelligence brainstorm', category: 'IDEAS' },
  { emoji: '💻', name: 'computer laptop dev code tech work programming developer', category: 'IDEAS' },
  { emoji: '📌', name: 'pin pushpin layout map board task pinboard', category: 'IDEAS' },
  { emoji: '📍', name: 'pin location map marker place target coordinates', category: 'IDEAS' },
  // STATUS
  { emoji: '✅', name: 'check correct yes success complete done verified green pass', category: 'STATUS' },
  { emoji: '❌', name: 'cross incorrect error wrong stop close red reject cancel', category: 'STATUS' },
  { emoji: '⚠️', name: 'warning alert caution attention yellow danger issue', category: 'STATUS' },
  { emoji: '❓', name: 'question help query ask blue faq', category: 'STATUS' },
  // FUN
  { emoji: '✨', name: 'sparkles shine magic clean stars gold shiny', category: 'FUN' },
  { emoji: '👑', name: 'crown king queen lead champion best winner leader', category: 'FUN' }
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [recents, setRecents] = useState<string[]>([]);

  // Load recently used emojis from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('syncsketch-recent-emojis');
      if (stored) {
        setRecents(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recents:", e);
    }
  }, []);

  const handleSelect = (emoji: string) => {
    onSelectEmoji(emoji);
    
    // Add to recents
    const nextRecents = [emoji, ...recents.filter(x => x !== emoji)].slice(0, 8);
    setRecents(nextRecents);
    try {
      localStorage.setItem('syncsketch-recent-emojis', JSON.stringify(nextRecents));
    } catch (e) {
      console.error("Failed to save recents:", e);
    }
  };

  // Filter emojis based on query & category
  const filtered = EMOJI_DATA.filter(item => {
    const matchesSearch = item.name.includes(search.toLowerCase()) || item.emoji === search;
    const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col w-64 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-2 font-sans select-none backdrop-blur-md">
      {/* Search Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl mb-2">
        <Search size={13} className="text-slate-400" />
        <input 
          type="text" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji..."
          className="flex-1 bg-transparent border-none text-xs text-slate-800 dark:text-zinc-100 focus:outline-none"
        />
        <button 
          onClick={onClose}
          className="p-0.5 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-md text-slate-400 hover:text-slate-650 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Recents List */}
      {recents.length > 0 && !search && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-1.5 mb-1">
            <Clock size={10} />
            <span>Recent</span>
          </div>
          <div className="flex flex-wrap gap-1 px-1">
            {recents.map(emoji => (
              <button 
                key={`recent-${emoji}`}
                onClick={() => handleSelect(emoji)}
                className="w-7 h-7 flex items-center justify-center text-base hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1 border-b border-slate-100 dark:border-zinc-800/80 pb-1.5 mb-1.5 overflow-x-auto scrollbar-none px-1">
        {[
          { id: 'ALL', label: 'All', icon: <Smile size={11} /> },
          { id: 'SMILEYS', label: 'Smileys', icon: <Smile size={11} /> },
          { id: 'REACTIONS', label: 'Reactions', icon: <Heart size={11} /> },
          { id: 'PEOPLE', label: 'People', icon: <Clock size={11} /> },
          { id: 'IDEAS', label: 'Ideas', icon: <Briefcase size={11} /> },
          { id: 'STATUS', label: 'Status', icon: <CheckCircle size={11} /> },
          { id: 'FUN', label: 'Fun', icon: <Sparkles size={11} /> }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              activeCategory === cat.id 
                ? 'bg-slate-100 dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Grid viewport */}
      <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto pr-1">
        {filtered.map(item => (
          <button 
            key={item.emoji}
            onClick={() => handleSelect(item.emoji)}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors active:scale-90"
            title={item.name}
          >
            {item.emoji}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-6 py-8 text-center text-xs text-slate-400 dark:text-zinc-500 flex flex-col items-center gap-1">
            <HelpCircle size={14} />
            <span>No emojis found</span>
          </div>
        )}
      </div>
    </div>
  );
};
