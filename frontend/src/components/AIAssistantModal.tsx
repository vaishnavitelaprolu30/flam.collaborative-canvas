import React, { useState } from 'react';
import { X, ArrowUp, Sparkles, Globe, GitFork, FileText, Image as ImageIcon, Smartphone, StickyNote, Frame, Table, Compass } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useBoardStore } from '../store/useBoardStore';
import { usePresenceStore } from '../store/usePresenceStore';
import { API_BASE_URL } from '../config';

interface AIAssistantModalProps {
  onClose: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ onClose }) => {
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { localUser } = usePresenceStore();
  const { boardTitle, setPan, zoom } = useUIStore();
  const { addElement, elements } = useBoardStore();

  const handleGenerate = async (selectedPrompt?: string) => {
    const textToUse = selectedPrompt || promptInput;
    if (!textToUse.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      // Calculate placement offset so new creations don't overlap existing objects
      let maxX = 200;
      let maxY = 200;
      elements.forEach(el => {
        maxX = Math.max(maxX, el.x + (el.width || 0));
        maxY = Math.max(maxY, el.y);
      });

      const startX = elements.length > 0 ? maxX + 150 : 200;
      const startY = 150;

      const response = await fetch(`${API_BASE_URL}/api/ai/generate-canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToUse.trim(),
          boardTitle,
          startX,
          startY
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.elements && Array.isArray(data.elements)) {
          data.elements.forEach((newEl: any) => addElement(newEl));

          // Smoothly pan camera to newly generated elements
          if (data.elements.length > 0) {
            const first = data.elements[0];
            setPan({
              x: -first.x * zoom + window.innerWidth / 2 - 300,
              y: -first.y * zoom + window.innerHeight / 2 - 150
            });
          }
        }
      }
    } catch (err) {
      console.error('AI Canvas generation failed:', err);
    } finally {
      setIsGenerating(false);
      onClose();
    }
  };

  const actionPills = [
    { label: '☁️ AWS Architecture', prompt: 'Generate AWS Cloud Architecture diagram for serverless web app' },
    { label: '🛢️ ER Schema', prompt: 'Generate Database ER Schema for e-commerce system' },
    { label: '🖥️ UI Wireframe', prompt: 'Generate UI Wireframe layout for desktop web application' },
    { label: '💡 Brainstorm ideas', prompt: 'Brainstorm creative ideas for product launch' },
    { label: '🗺️ Map user journey', prompt: 'Map user journey for onboarding flow' },
    { label: '📅 Plan roadmap', prompt: 'Plan product roadmap for Q3 and Q4 milestones' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header Greeting */}
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-zinc-100 tracking-tight mb-1">
            Hey {localUser.displayName || 'srivaishnavi_telaprolu'}, what are we working on today?
          </h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Google Gemini 1.5 Flash • Active Provider</span>
          </div>
        </div>

        {/* Input Box Card */}
        <div className="bg-slate-50/80 dark:bg-zinc-850/60 border border-slate-200 dark:border-zinc-750 rounded-2xl p-4 mb-5 flex flex-col gap-3 shadow-inner">
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder="I want to create..."
            rows={3}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none resize-none leading-relaxed font-normal"
          />

          {/* Action icon row + submit button */}
          <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-zinc-750/80 pt-3">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
              <button title="Embed Web Resources" onClick={() => handleGenerate('Embed web documentation resource cards')}>
                <Globe size={15} className="hover:text-brand-500 cursor-pointer transition-colors" />
              </button>
              <button title="Generate Workflow Diagram" onClick={() => handleGenerate('Generate intelligent workflow diagram')}>
                <GitFork size={15} className="hover:text-brand-500 cursor-pointer transition-colors" />
              </button>
              <button title="Create Requirements Doc" onClick={() => handleGenerate('Create technical requirements doc spec')}>
                <FileText size={15} className="hover:text-brand-500 cursor-pointer transition-colors" />
              </button>
              <button title="Generate AI Image" onClick={() => handleGenerate('Generate futuristic cyberpunk landscape image')}>
                <ImageIcon size={15} className="hover:text-brand-500 cursor-pointer transition-colors" />
              </button>
              <button title="Generate Mobile Wireframe" onClick={() => handleGenerate('Generate UI Wireframe layout for mobile app')}>
                <Smartphone size={15} className="hover:text-brand-500 cursor-pointer transition-colors" />
              </button>
              <button title="Brainstorm Sticky Notes" onClick={() => handleGenerate('Brainstorm creative ideas for product launch')}>
                <StickyNote size={15} className="hover:text-brand-500 cursor-pointer transition-colors" />
              </button>
              <button title="Plan Roadmap Frame" onClick={() => handleGenerate('Plan product roadmap for Q3 and Q4 milestones')}>
                <Frame size={15} className="hover:text-brand-500 cursor-pointer transition-colors" />
              </button>
              <button title="Generate Database ER Schema Table" onClick={() => handleGenerate('Generate Database ER Schema table')}>
                <Table size={15} className="hover:text-brand-500 cursor-pointer transition-colors" />
              </button>
            </div>

            <button
              onClick={() => handleGenerate()}
              disabled={!promptInput.trim() || isGenerating}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                promptInput.trim() && !isGenerating
                  ? 'bg-brand-500 text-white shadow-md hover:bg-brand-600'
                  : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <Sparkles size={16} className="animate-spin text-white" />
              ) : (
                <ArrowUp size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Quick Action Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          {actionPills.map((pill) => (
            <button
              key={pill.label}
              onClick={() => handleGenerate(pill.prompt)}
              disabled={isGenerating}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-full text-xs font-semibold transition-all hover:scale-[1.03] active:scale-[0.98] border border-slate-200/60 dark:border-zinc-700"
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Secondary Links */}
        <div className="flex items-center justify-center gap-6 text-xs font-semibold text-slate-500 dark:text-zinc-400">
          <button onClick={() => handleGenerate('Map user journey')} className="flex items-center gap-1.5 hover:text-brand-500 transition-colors">
            <Compass size={14} />
            <span>Explore Flows</span>
          </button>
          <button onClick={() => handleGenerate('Brainstorm ideas')} className="flex items-center gap-1.5 hover:text-brand-500 transition-colors">
            <Sparkles size={14} className="text-brand-500" />
            <span>Explore Sidekick</span>
          </button>
        </div>
      </div>
    </div>
  );
};
