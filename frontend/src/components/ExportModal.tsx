import React from 'react';
import { X, Image as ImageIcon, FileJson, Download, Upload, FileCode, FileText } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { useUIStore } from '../store/useUIStore';

interface ExportModalProps {
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const { elements, setElements } = useBoardStore();
  const { boardTitle } = useUIStore();

  const handleExportPNG = () => {
    // Select Konva canvas stage and export to data URL
    const stage = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement;
    if (!stage) {
      alert('Canvas stage not found');
      return;
    }
    const dataUrl = stage.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${boardTitle.toLowerCase().replace(/\s+/g, '-')}-canvas.png`;
    link.href = dataUrl;
    link.click();
    onClose();
  };

  const handleExportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify({ title: boardTitle, version: 1, exportedAt: Date.now(), elements }, null, 2)
    )}`;
    const link = document.createElement('a');
    link.download = `${boardTitle.toLowerCase().replace(/\s+/g, '-')}-backup.json`;
    link.href = jsonString;
    link.click();
    onClose();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.elements && Array.isArray(parsed.elements)) {
          setElements(parsed.elements);
          alert(`Successfully imported ${parsed.elements.length} elements!`);
          onClose();
        } else {
          alert('Invalid backup JSON format');
        }
      } catch (err) {
        alert('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleExportSVG = () => {
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">\n`;
    svgContent += `  <rect width="100%" height="100%" fill="#ffffff" />\n`;
    elements.forEach(el => {
      svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width || 100}" height="${el.height || 100}" fill="${el.fill || '#e0f2fe'}" stroke="${el.stroke || '#0284c7'}" stroke-width="${el.strokeWidth || 1}" rx="8" />\n`;
    });
    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `${boardTitle.toLowerCase().replace(/\s+/g, '-')}-canvas.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    onClose();
  };

  const handleExportMarkdown = () => {
    let md = `# Board Summary: ${boardTitle}\n\n`;
    md += `Exported on: ${new Date().toLocaleString()}\n\n`;
    md += `## Canvas Elements (${elements.length})\n\n`;
    elements.forEach((el: any, idx) => {
      md += `### ${idx + 1}. [${el.type.toUpperCase()}] ${el.title || el.text || 'Unnamed Element'}\n`;
      md += `- Position: (${el.x}, ${el.y})\n`;
      md += `- Size: ${el.width || 0}x${el.height || 0}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.download = `${boardTitle.toLowerCase().replace(/\s+/g, '-')}-summary.md`;
    link.href = URL.createObjectURL(blob);
    link.click();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 rounded-2xl">
              <Download size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Export & Import Suite</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Save board snapshot or import backup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 flex flex-col gap-3">
          {/* PNG Download */}
          <button
            onClick={handleExportPNG}
            className="p-3.5 border border-slate-200 dark:border-zinc-800 hover:border-brand-500 rounded-2xl bg-slate-50 dark:bg-zinc-850 hover:bg-white dark:hover:bg-zinc-800 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <ImageIcon size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">Export PNG Image</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400">High quality raster canvas image</div>
              </div>
            </div>
            <Download size={15} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
          </button>

          {/* Vector SVG Export */}
          <button
            onClick={handleExportSVG}
            className="p-3.5 border border-slate-200 dark:border-zinc-800 hover:border-brand-500 rounded-2xl bg-slate-50 dark:bg-zinc-850 hover:bg-white dark:hover:bg-zinc-800 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                <FileCode size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">Export Vector SVG</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400">Scalable vector graphics diagram</div>
              </div>
            </div>
            <Download size={15} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
          </button>

          {/* Markdown Summary */}
          <button
            onClick={handleExportMarkdown}
            className="p-3.5 border border-slate-200 dark:border-zinc-800 hover:border-brand-500 rounded-2xl bg-slate-50 dark:bg-zinc-850 hover:bg-white dark:hover:bg-zinc-800 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
                <FileText size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">Export Markdown Summary</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400">Structured markdown document outline</div>
              </div>
            </div>
            <Download size={15} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
          </button>

          {/* JSON Export */}
          <button
            onClick={handleExportJSON}
            className="p-3.5 border border-slate-200 dark:border-zinc-800 hover:border-brand-500 rounded-2xl bg-slate-50 dark:bg-zinc-850 hover:bg-white dark:hover:bg-zinc-800 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 rounded-xl">
                <FileJson size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">Export JSON Backup</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400">Complete raw board elements schema</div>
              </div>
            </div>
            <Download size={15} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
          </button>

          {/* JSON Import */}
          <label className="p-3.5 border border-dashed border-slate-300 dark:border-zinc-700 hover:border-brand-500 rounded-2xl bg-slate-50/50 dark:bg-zinc-850/50 hover:bg-white dark:hover:bg-zinc-800 transition-all flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <Upload size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">Import JSON Board</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400">Load elements from a saved JSON file</div>
              </div>
            </div>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            <Upload size={15} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
          </label>
        </div>
      </div>
    </div>
  );
};
