import React, { useState } from 'react';
import { X, Upload, FileText, Table, FileCode, Check } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';

interface FileImportModalProps {
  onClose: () => void;
}

export const FileImportModal: React.FC<FileImportModalProps> = ({ onClose }) => {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [importType, setImportType] = useState<'markdown' | 'csv' | 'json'>('markdown');
  const { addElement, elements } = useBoardStore();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setFileContent(text);
      if (file.name.endsWith('.csv')) setImportType('csv');
      else if (file.name.endsWith('.json')) setImportType('json');
      else setImportType('markdown');
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (!fileContent.trim()) return;

    let maxX = 200;
    elements.forEach(el => {
      maxX = Math.max(maxX, el.x + (el.width || 0));
    });

    const startX = elements.length > 0 ? maxX + 150 : 200;
    const startY = 150;

    if (importType === 'json') {
      try {
        const parsed = JSON.parse(fileContent);
        if (parsed.elements && Array.isArray(parsed.elements)) {
          parsed.elements.forEach((el: any) => addElement(el));
        }
      } catch (err) {
        console.error('JSON parse failed:', err);
      }
    } else if (importType === 'csv') {
      // Parse CSV into TableElement
      const lines = fileContent.split('\n').filter(l => l.trim());
      const rows = lines.map(l => l.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1')));
      if (rows.length > 0) {
        const newTable: any = {
          id: `tbl_imp_${Math.random().toString(36).substring(2, 9)}`,
          type: 'table',
          rows: rows.length,
          cols: rows[0].length,
          cellsData: rows,
          x: startX,
          y: startY,
          width: Math.max(300, rows[0].length * 120),
          height: Math.max(180, rows.length * 40),
          opacity: 1,
          rotation: 0,
          stroke: '#3b82f6',
          strokeWidth: 2,
          fill: '#ffffff',
          isLocked: false,
          createdBy: 'import',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        addElement(newTable);
      }
    } else {
      // Parse Markdown into Frame with Sticky Notes
      const lines = fileContent.split('\n').filter(l => l.trim());
      const frameId = `frame_md_${Math.random().toString(36).substring(2, 9)}`;
      
      addElement({
        id: frameId,
        type: 'frame',
        title: `📄 Document: ${fileName || 'Imported Notes'}`,
        x: startX,
        y: startY,
        width: 800,
        height: Math.max(400, lines.length * 50),
        stroke: '#8b5cf6',
        strokeWidth: 2,
        fill: '#fef2f2',
        opacity: 1,
        rotation: 0,
        isLocked: false,
        createdBy: 'import',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      lines.slice(0, 8).forEach((line, idx) => {
        addElement({
          id: `stk_md_${idx}`,
          type: 'sticky',
          text: line.replace(/^#+\s*/, ''),
          x: startX + 40,
          y: startY + 60 + idx * 75,
          width: 720,
          height: 60,
          fontSize: 14,
          stickyColor: '#fef08a',
          stroke: 'transparent',
          strokeWidth: 1,
          fill: '#fef08a',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'import',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-500 rounded-xl text-white">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-800 dark:text-zinc-100">Multi-Format File Importer</h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Import Markdown, CSV, JSON, or PDF files</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {/* Upload Drop Zone */}
        <label className="border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-brand-500 dark:hover:border-brand-500 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center gap-2 mb-4 bg-slate-50 dark:bg-zinc-950">
          <Upload size={24} className="text-brand-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
            {fileName ? fileName : 'Click to Upload Markdown, CSV, or JSON'}
          </span>
          <span className="text-[10px] text-slate-400">Supports .md, .csv, .json files</span>
          <input type="file" accept=".md,.txt,.csv,.json" onChange={handleFileUpload} className="hidden" />
        </label>

        {/* Import Format Radio Tabs */}
        <div className="flex items-center justify-between bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl mb-5">
          {[
            { id: 'markdown', label: 'Markdown Doc', icon: <FileText size={14} /> },
            { id: 'csv', label: 'CSV Table', icon: <Table size={14} /> },
            { id: 'json', label: 'JSON Canvas', icon: <FileCode size={14} /> }
          ].map(fmt => (
            <button
              key={fmt.id}
              onClick={() => setImportType(fmt.id as any)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                importType === fmt.id
                  ? 'bg-white dark:bg-zinc-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
              }`}
            >
              {fmt.icon}
              <span>{fmt.label}</span>
            </button>
          ))}
        </div>

        {/* Manual Content Preview Textarea */}
        <div className="flex flex-col gap-2 mb-5">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">File Raw Content</label>
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            placeholder="Paste raw text, CSV rows, or Markdown notes here..."
            rows={4}
            className="w-full p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-zinc-100"
          />
        </div>

        {/* Execute Button */}
        <button
          onClick={handleExecuteImport}
          disabled={!fileContent.trim()}
          className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-2xl shadow-lg disabled:opacity-40 transition-all flex items-center justify-center gap-2 text-xs"
        >
          <Check size={16} />
          <span>Convert & Place on Canvas</span>
        </button>
      </div>
    </div>
  );
};
