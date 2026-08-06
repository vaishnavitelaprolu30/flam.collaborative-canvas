import React, { useState } from 'react';
import { X, Globe, Link2, Plus } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { useUIStore } from '../store/useUIStore';

interface WebResourceModalProps {
  onClose: () => void;
}

export const WebResourceModal: React.FC<WebResourceModalProps> = ({ onClose }) => {
  const [urlInput, setUrlInput] = useState('');
  const { addElement, elements } = useBoardStore();
  const { setPan, zoom } = useUIStore();

  const handleEmbedUrl = (urlToEmbed: string, title: string) => {
    let maxX = 200;
    elements.forEach(el => {
      maxX = Math.max(maxX, el.x + (el.width || 0));
    });

    const newEmbed: any = {
      id: `embed_${Math.random().toString(36).substring(2, 9)}`,
      type: 'embed',
      url: urlToEmbed,
      embedType: urlToEmbed.includes('youtube') ? 'youtube' : 'website',
      title,
      x: elements.length > 0 ? maxX + 100 : 200,
      y: 150,
      width: 360,
      height: 220,
      opacity: 1,
      rotation: 0,
      stroke: '#38bdf8',
      strokeWidth: 2,
      fill: '#1e293b',
      isLocked: false,
      createdBy: 'web-search',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    addElement(newEmbed);

    setPan({
      x: -newEmbed.x * zoom + window.innerWidth / 2 - 180,
      y: -newEmbed.y * zoom + window.innerHeight / 2 - 110
    });

    onClose();
  };

  const sampleResources = [
    { title: 'TypeScript Official Docs & Manual', url: 'https://www.typescriptlang.org/docs/' },
    { title: 'React Documentation & Hooks Reference', url: 'https://react.dev' },
    { title: 'Tailwind CSS Design System Framework', url: 'https://tailwindcss.com' },
    { title: 'Web Whiteboard Architecture Standards', url: 'https://w3.org' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500 rounded-xl text-white">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-800 dark:text-zinc-100">Web Search & Resource Embeds</h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Search online resources and embed live cards</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {/* Direct URL Input */}
        <div className="flex flex-col gap-2 mb-5">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Embed Custom URL / Website</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com or YouTube video link..."
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 dark:text-zinc-100"
            />
            <button
              onClick={() => urlInput.trim() && handleEmbedUrl(urlInput.trim(), 'Custom Embedded Resource')}
              disabled={!urlInput.trim()}
              className="px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-sm disabled:opacity-40 transition-all flex items-center gap-1"
            >
              <Plus size={15} />
              <span>Embed</span>
            </button>
          </div>
        </div>

        {/* Preset Online Resources List */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Recommended Developer Resources</label>
          <div className="flex flex-col gap-2">
            {sampleResources.map((res, idx) => (
              <div
                key={idx}
                onClick={() => handleEmbedUrl(res.url, res.title)}
                className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 border border-slate-200 dark:border-zinc-800 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Link2 size={15} />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {res.title}
                    </div>
                    <div className="text-[10px] text-slate-400">{res.url}</div>
                  </div>
                </div>
                <Plus size={16} className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
