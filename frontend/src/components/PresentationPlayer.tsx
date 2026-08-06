import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MessageSquare,
  BarChart2,
  Sparkles,
  Clock,
} from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';

interface PresentationPlayerProps {
  onClose: () => void;
  startFrameId?: string;
}

export const PresentationPlayer: React.FC<PresentationPlayerProps> = ({ onClose, startFrameId }) => {
  const { elements } = useBoardStore();

  // Find all frames or create default presentation slides
  const frameElements = elements.filter((el) => el.type === 'frame');

  const slides = frameElements.length > 0 ? frameElements : [
    { id: 'slide1', title: '🚀 Welcome to Interactive Presentation', fill: '#1e293b' },
    { id: 'slide2', title: '📊 Project Roadmap & Key Milestones', fill: '#0f172a' },
    { id: 'slide3', title: '🧠 Team Brainstorming & Feedback Insights', fill: '#1e1b4b' },
    { id: 'slide4', title: '💡 Q&A and Audience Polls', fill: '#064e3b' },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Sync initial slide index if startFrameId provided
  useEffect(() => {
    if (startFrameId) {
      const idx = slides.findIndex((s) => s.id === startFrameId);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [startFrameId, slides]);

  // Autoplay Timer Effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, slides.length]);

  // Presentation Timer Clock
  useEffect(() => {
    const clock = setInterval(() => {
      setTimerSeconds((t) => t + 1);
    }, 1000);
    return () => clearInterval(clock);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentSlide = slides[currentIndex];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between select-none animate-in fade-in duration-200 font-sans">
      {/* TOP PRESENTATION BAR */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-sm shadow-md">
            ▶
          </div>
          <div>
            <h2 className="font-bold text-sm tracking-tight text-slate-100">
              {(currentSlide as any).title || `Slide ${currentIndex + 1}`}
            </h2>
            <span className="text-[11px] text-slate-400">
              Presentation Mode • {currentIndex + 1} of {slides.length} slides
            </span>
          </div>
        </div>

        {/* Live Presentation Indicators & Timer */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs font-mono text-emerald-400">
            <Clock size={13} />
            <span>{formatTimer(timerSeconds)}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>LIVE SESSION</span>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            title="Exit Presentation Mode (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* MAIN SLIDE VIEW AREA */}
      <main className="flex-1 relative flex items-center justify-center p-8 overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="relative w-full max-w-5xl aspect-video bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between p-12 transition-all duration-300">
          {/* Slide Top Badge */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <Sparkles size={14} />
              <span>Interactive Slide</span>
            </span>
            <span className="text-xs font-mono text-slate-500">
              SLIDE #{currentIndex + 1}
            </span>
          </div>

          {/* Slide Center Content */}
          <div className="my-auto space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              {(currentSlide as any).title || `Presentation Slide ${currentIndex + 1}`}
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl font-normal leading-relaxed">
              This slide contains live collaborative widgets, audience feedback, and interactive retrospective items from your infinite SyncSketch canvas.
            </p>

            {/* Interactive Poll / Activity Cards preview */}
            <div className="grid grid-cols-3 gap-4 pt-6">
              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex flex-col gap-2">
                <span className="text-xs font-bold text-blue-400">🗳️ Live Poll</span>
                <span className="text-sm font-semibold text-white">What feature should we prioritize next?</span>
                <span className="text-[11px] text-slate-400">42 votes submitted</span>
              </div>

              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex flex-col gap-2">
                <span className="text-xs font-bold text-amber-400">💬 Word Cloud</span>
                <span className="text-sm font-semibold text-white">Describe the product vision in 1 word</span>
                <span className="text-[11px] text-slate-400">18 responses</span>
              </div>

              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex flex-col gap-2">
                <span className="text-xs font-bold text-emerald-400">⚡ Q&A Board</span>
                <span className="text-sm font-semibold text-white">Top voted audience questions</span>
                <span className="text-[11px] text-slate-400">9 active threads</span>
              </div>
            </div>
          </div>

          {/* Slide Footer */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
            <span>SyncSketch Interactive Canvas</span>
            <span>Press Space or Arrow keys to navigate</span>
          </div>
        </div>
      </main>

      {/* BOTTOM CONTROL DOCK */}
      <footer className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 backdrop-blur-md flex items-center justify-between z-10">
        {/* Navigation Arrows & Count */}
        <div className="flex items-center gap-3">
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-2xl text-white transition-all"
            title="Previous Slide (←)"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="text-xs font-bold font-mono px-3 py-1.5 bg-slate-850 rounded-xl border border-slate-700/60 text-slate-200">
            {currentIndex + 1} / {slides.length}
          </span>

          <button
            disabled={currentIndex === slides.length - 1}
            onClick={() => setCurrentIndex((prev) => Math.min(slides.length - 1, prev + 1))}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-2xl text-white transition-all"
            title="Next Slide (→)"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Play/Pause Autoplay */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center gap-2 transition-all"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause Autoplay' : 'Autoplay Deck'}</span>
          </button>
        </div>

        {/* Tools & Fullscreen */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPolls(!showPolls)}
            className={`p-2.5 rounded-2xl border transition-all ${
              showPolls
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
            title="Audience Polls & Engagement"
          >
            <BarChart2 size={16} />
          </button>

          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-2.5 rounded-2xl border transition-all ${
              showNotes
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-slate-800 border-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
            title="Speaker Notes"
          >
            <MessageSquare size={16} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-2xl text-slate-300 transition-all"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </footer>
    </div>
  );
};
