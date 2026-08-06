import React, { useState } from 'react';
import { X, Sparkles, Download, Check, Wand2 } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { useUIStore } from '../store/useUIStore';
import { API_BASE_URL } from '../config';

interface AIImageModalProps {
  onClose: () => void;
}

export const AIImageModal: React.FC<AIImageModalProps> = ({ onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('photorealistic');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:3'>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const { addElement, elements } = useBoardStore();
  const { setPan, zoom } = useUIStore();

  const styles = [
    { id: 'photorealistic', label: 'Photorealistic' },
    { id: 'pixar 3d', label: 'Pixar 3D' },
    { id: 'cyberpunk neon', label: 'Cyberpunk' },
    { id: 'anime art', label: 'Anime' },
    { id: 'watercolor painting', label: 'Watercolor' },
    { id: 'vector logo icon', label: 'Logo / Icon' },
    { id: 'isometric 3d sticker', label: 'Sticker' }
  ];

  const handleGenerateImage = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const dimensions = {
        '16:9': { width: 800, height: 450 },
        '1:1': { width: 500, height: 500 },
        '4:3': { width: 640, height: 480 }
      }[aspectRatio];

      const response = await fetch(`${API_BASE_URL}/api/ai/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style: selectedStyle,
          width: dimensions.width,
          height: dimensions.height
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedImageUrl(data.imageUrl);
      }
    } catch (err) {
      console.error('Image generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlaceOnCanvas = () => {
    if (!generatedImageUrl) return;

    let maxX = 200;
    elements.forEach(el => {
      maxX = Math.max(maxX, el.x + (el.width || 0));
    });

    const dimensions = {
      '16:9': { width: 560, height: 315 },
      '1:1': { width: 400, height: 400 },
      '4:3': { width: 480, height: 360 }
    }[aspectRatio];

    const newImage: any = {
      id: `img_${Math.random().toString(36).substring(2, 9)}`,
      type: 'image',
      src: generatedImageUrl,
      alt: prompt,
      x: elements.length > 0 ? maxX + 100 : 200,
      y: 150,
      width: dimensions.width,
      height: dimensions.height,
      opacity: 1,
      rotation: 0,
      stroke: 'transparent',
      strokeWidth: 1,
      fill: 'transparent',
      isLocked: false,
      createdBy: 'ai',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    addElement(newImage);

    setPan({
      x: -newImage.x * zoom + window.innerWidth / 2 - 250,
      y: -newImage.y * zoom + window.innerHeight / 2 - 180
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-xl text-white">
              <Wand2 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-800 dark:text-zinc-100">AI Image Studio</h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Generate high-res generative images & art</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {/* Prompt Input */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Prompt Description</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A dolphin leaping out of tropical turquoise ocean at sunset..."
            rows={3}
            className="w-full p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-900 dark:text-zinc-100"
          />
        </div>

        {/* Style Selector */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Art Style</label>
          <div className="flex flex-wrap gap-1.5">
            {styles.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStyle(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedStyle === s.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex items-center justify-between mb-5 bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl border border-slate-200/60 dark:border-zinc-800">
          <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Aspect Ratio</span>
          <div className="flex gap-1.5">
            {(['16:9', '1:1', '4:3'] as const).map(ratio => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  aspectRatio === ratio
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerateImage}
          disabled={!prompt.trim() || isGenerating}
          className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-purple-500/25 disabled:opacity-40 transition-all flex items-center justify-center gap-2 text-xs mb-4"
        >
          {isGenerating ? (
            <>
              <Sparkles size={16} className="animate-spin text-white" />
              <span>Generating Generative Art...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Generate AI Image</span>
            </>
          )}
        </button>

        {/* Generated Image Preview Area */}
        {generatedImageUrl && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950 max-h-56 flex items-center justify-center">
              <img src={generatedImageUrl} alt="Generated AI preview" className="w-full h-full object-cover" />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePlaceOnCanvas}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Check size={15} />
                <span>Place on Canvas</span>
              </button>
              <a
                href={generatedImageUrl}
                download="ai-generated-artwork.png"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold rounded-xl text-xs transition-all flex items-center gap-1"
              >
                <Download size={15} />
                <span>Download</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
