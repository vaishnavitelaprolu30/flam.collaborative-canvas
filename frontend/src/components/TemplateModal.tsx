import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Search,
  Globe,
  Grid,
  HelpCircle,
} from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useBoardStore } from '../store/useBoardStore';
import { CanvasElement } from '../types/canvas';

interface TemplateModalProps {
  onClose: () => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({ onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOnBoardCreation, setShowOnBoardCreation] = useState<boolean>(true);
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);

  const { addElements, elements } = useBoardStore();
  const { setSelectedElementIds, setPan } = useUIStore();

  const generateTemplateElements = (templateId: string): CanvasElement[] => {
    const now = Date.now();
    const baseId = Math.random().toString(36).substring(2, 7);
    const startX = 200 + (elements.length > 0 ? 600 : 0);
    const startY = 150;

    const templateList: CanvasElement[] = [];

    if (templateId === 'flowchart' || templateId === 'diagramming') {
      // Flowchart Diagram
      const frameId = `frame_${baseId}_flow`;
      templateList.push({
        id: frameId,
        type: 'frame',
        title: '📊 Process Flowchart Diagram',
        x: startX,
        y: startY,
        width: 1000,
        height: 600,
        stroke: '#64748b',
        strokeWidth: 2,
        fill: '#ffffff',
        opacity: 1,
        rotation: 0,
        isLocked: false,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      } as any);

      const nodes = [
        { id: `n1_${baseId}`, label: 'User Onboarding Request', type: 'rounded-rectangle', x: startX + 60, y: startY + 250, fill: '#3b82f6', color: '#ffffff' },
        { id: `n2_${baseId}`, label: 'Validate SSO Credentials', type: 'rectangle', x: startX + 320, y: startY + 250, fill: '#8b5cf6', color: '#ffffff' },
        { id: `n3_${baseId}`, label: 'Is Auth Token Valid?', type: 'diamond', x: startX + 580, y: startY + 230, fill: '#f59e0b', color: '#ffffff' },
        { id: `n4_${baseId}`, label: 'Grant Workspace Access', type: 'rounded-rectangle', x: startX + 800, y: startY + 160, fill: '#10b981', color: '#ffffff' },
        { id: `n5_${baseId}`, label: 'Show Error Notification', type: 'rounded-rectangle', x: startX + 800, y: startY + 340, fill: '#ef4444', color: '#ffffff' },
      ];

      nodes.forEach((n) => {
        templateList.push({
          id: n.id,
          type: n.type as any,
          x: n.x,
          y: n.y,
          width: n.type === 'diamond' ? 140 : 180,
          height: n.type === 'diamond' ? 120 : 80,
          stroke: n.fill,
          strokeWidth: 2,
          fill: n.fill,
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        } as any);

        templateList.push({
          id: `text_${n.id}`,
          type: 'text',
          text: n.label,
          x: n.x + 10,
          y: n.y + (n.type === 'diamond' ? 40 : 25),
          width: n.type === 'diamond' ? 120 : 160,
          height: 30,
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          align: 'center',
          stroke: n.color,
          strokeWidth: 1,
          fill: 'transparent',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        });
      });
    } else if (templateId === 'retro' || templateId === 'brainwriting' || templateId === 'standup') {
      // Retrospective / Brainwriting / Standup
      const frameId = `frame_${baseId}_retro`;
      templateList.push({
        id: frameId,
        type: 'frame',
        title: '🚀 Retrospective & Brainwriting',
        x: startX,
        y: startY,
        width: 1100,
        height: 700,
        stroke: '#94a3b8',
        strokeWidth: 2,
        fill: '#f8fafc',
        opacity: 1,
        rotation: 0,
        isLocked: false,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      } as any);

      const columns = [
        { title: '🟢 What Went Well', color: '#bbf7d0', notes: ['Great team collaboration', '60fps canvas performance', 'Realtime socket sync'] },
        { title: '🔴 What Needs Improvement', color: '#fbcfe8', notes: ['Integration test coverage', 'Mobile viewport padding'] },
        { title: '💡 Action Items', color: '#bfdbfe', notes: ['Refactor auth handlers', 'Add vector export feature'] },
      ];

      columns.forEach((col, cIdx) => {
        const colX = startX + 40 + cIdx * 350;
        const colY = startY + 60;

        templateList.push({
          id: `rect_${baseId}_col_${cIdx}`,
          type: 'rectangle',
          x: colX,
          y: colY,
          width: 320,
          height: 600,
          stroke: col.color,
          strokeWidth: 2,
          fill: '#ffffff',
          opacity: 0.9,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
          borderRadius: 16,
        } as any);

        templateList.push({
          id: `text_${baseId}_col_title_${cIdx}`,
          type: 'text',
          text: col.title,
          x: colX + 16,
          y: colY + 16,
          width: 280,
          height: 36,
          fontSize: 18,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          align: 'left',
          stroke: '#1e293b',
          strokeWidth: 1,
          fill: 'transparent',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        });

        col.notes.forEach((noteText, nIdx) => {
          templateList.push({
            id: `sticky_${baseId}_${cIdx}_${nIdx}`,
            type: 'sticky',
            text: noteText,
            x: colX + 25,
            y: colY + 80 + nIdx * 150,
            width: 270,
            height: 130,
            fontSize: 15,
            fontFamily: 'sans-serif',
            align: 'left',
            stickyColor: col.color,
            stroke: 'transparent',
            strokeWidth: 1,
            fill: col.color,
            opacity: 1,
            rotation: 0,
            isLocked: false,
            createdBy: 'system',
            createdAt: now,
            updatedAt: now,
          } as any);
        });
      });
    } else if (templateId === 'roadmap-tracking' || templateId === 'timeline') {
      // Roadmap & Timeline Template
      const frameId = `frame_${baseId}_roadmap`;
      templateList.push({
        id: frameId,
        type: 'frame',
        title: '🗺️ Product Roadmap & Strategic Timeline',
        x: startX,
        y: startY,
        width: 1100,
        height: 650,
        stroke: '#3b82f6',
        strokeWidth: 2,
        fill: '#ffffff',
        opacity: 1,
        rotation: 0,
        isLocked: false,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      } as any);

      const phases = [
        { title: 'Q1: Foundation & MVP', color: '#eff6ff', border: '#3b82f6', items: ['Canvas Core Engine', 'Realtime Socket Sync', 'Auth Infrastructure'] },
        { title: 'Q2: AI & Collaboration', color: '#fefce8', border: '#eab308', items: ['AI Diagram Assistant', 'Presentation Player', 'Multi-user Cursors'] },
        { title: 'Q3: Scale & Ecosystem', color: '#ecfdf5', border: '#10b981', items: ['Plugin Ecosystem', 'Enterprise SSO', 'Export to Figma/PDF'] },
      ];

      phases.forEach((p, pIdx) => {
        const pX = startX + 40 + pIdx * 340;
        const pY = startY + 60;

        templateList.push({
          id: `rect_phase_${baseId}_${pIdx}`,
          type: 'rectangle',
          x: pX,
          y: pY,
          width: 320,
          height: 540,
          stroke: p.border,
          strokeWidth: 2,
          fill: p.color,
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        } as any);

        templateList.push({
          id: `text_phase_${baseId}_${pIdx}`,
          type: 'text',
          text: p.title,
          x: pX + 15,
          y: pY + 20,
          width: 290,
          height: 35,
          fontSize: 16,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          align: 'left',
          stroke: '#1e293b',
          strokeWidth: 1,
          fill: 'transparent',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        });

        p.items.forEach((itemText, iIdx) => {
          templateList.push({
            id: `sticky_phase_${baseId}_${pIdx}_${iIdx}`,
            type: 'sticky',
            text: itemText,
            x: pX + 20,
            y: pY + 80 + iIdx * 140,
            width: 280,
            height: 120,
            fontSize: 14,
            stickyColor: p.border,
            fill: '#ffffff',
            stroke: p.border,
            strokeWidth: 1,
            opacity: 1,
            rotation: 0,
            isLocked: false,
            createdBy: 'system',
            createdAt: now,
            updatedAt: now,
          } as any);
        });
      });
    } else if (templateId === 'goal-setting') {
      // Goal Setting (OKR) Template
      const frameId = `frame_${baseId}_okr`;
      templateList.push({
        id: frameId,
        type: 'frame',
        title: '🎯 Quarterly OKRs & Key Results',
        x: startX,
        y: startY,
        width: 1050,
        height: 600,
        stroke: '#10b981',
        strokeWidth: 2,
        fill: '#f0fdf4',
        opacity: 1,
        rotation: 0,
        isLocked: false,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      } as any);

      ['Objective 1: Achieve 99.9% Uptime & 60fps Performance', 'Objective 2: Expand Active User Base by 200%'].forEach((objText, oIdx) => {
        const objY = startY + 60 + oIdx * 250;
        templateList.push({
          id: `rect_okr_${baseId}_${oIdx}`,
          type: 'rectangle',
          x: startX + 40,
          y: objY,
          width: 970,
          height: 220,
          stroke: '#10b981',
          strokeWidth: 2,
          fill: '#ffffff',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        } as any);

        templateList.push({
          id: `text_okr_${baseId}_${oIdx}`,
          type: 'text',
          text: objText,
          x: startX + 60,
          y: objY + 20,
          width: 930,
          height: 40,
          fontSize: 18,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          align: 'left',
          stroke: '#065f46',
          strokeWidth: 1,
          fill: 'transparent',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        });

        ['KR 1: Render 1,000 canvas elements without lag', 'KR 2: Complete WebSocket auto-reconnect under 200ms'].forEach((krText, kIdx) => {
          templateList.push({
            id: `sticky_kr_${baseId}_${oIdx}_${kIdx}`,
            type: 'sticky',
            text: krText,
            x: startX + 60 + kIdx * 450,
            y: objY + 70,
            width: 420,
            height: 120,
            fontSize: 14,
            stickyColor: '#bbf7d0',
            fill: '#bbf7d0',
            stroke: 'transparent',
            strokeWidth: 1,
            opacity: 1,
            rotation: 0,
            isLocked: false,
            createdBy: 'system',
            createdAt: now,
            updatedAt: now,
          } as any);
        });
      });
    } else {
      // Default Project Workspace / AI Playground / General Template
      const frameId = `frame_${baseId}_gen`;
      templateList.push({
        id: frameId,
        type: 'frame',
        title: '🎨 AI Playground & Collaborative Workspace',
        x: startX,
        y: startY,
        width: 1000,
        height: 650,
        stroke: '#4262ff',
        strokeWidth: 2,
        fill: '#ffffff',
        opacity: 1,
        rotation: 0,
        isLocked: false,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      } as any);

      ['💡 Brainstorm Core Vision', '⚡ AI Generation Module', '🎯 Production Release'].forEach((t, i) => {
        templateList.push({
          id: `sticky_gen_${baseId}_${i}`,
          type: 'sticky',
          text: t,
          x: startX + 60 + i * 300,
          y: startY + 100,
          width: 260,
          height: 160,
          fontSize: 16,
          stickyColor: i === 0 ? '#fef08a' : i === 1 ? '#bfdbfe' : '#bbf7d0',
          fill: i === 0 ? '#fef08a' : i === 1 ? '#bfdbfe' : '#bbf7d0',
          stroke: 'transparent',
          strokeWidth: 1,
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        } as any);
      });
    }

    return templateList;
  };

  const handleUseTemplate = (templateId: string) => {
    const newElements = generateTemplateElements(templateId);
    addElements(newElements);

    if (newElements.length > 0) {
      setSelectedElementIds([newElements[0].id]);
      setPan({ x: -newElements[0].x + 300, y: -newElements[0].y + 150 });
    }

    onClose();
  };

  // Template catalog
  const allTemplates = [
    {
      id: 'ai-playground',
      title: 'AI Playground',
      category: 'ai',
      useCase: 'Research & design',
      badge: 'AI',
      badgeColor: '#8b5cf6',
      thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'project-workspace',
      title: 'Project Workspace',
      category: 'agile',
      useCase: 'Agile workflows',
      badge: 'Blueprint',
      badgeColor: '#3b82f6',
      thumbnail: 'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'roadmap-tracking',
      title: 'Roadmap Tracking Blueprint',
      category: 'management',
      useCase: 'Strategy & planning',
      badge: 'Blueprint',
      badgeColor: '#3b82f6',
      thumbnail: 'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'goal-setting',
      title: 'Goal Setting (OKR)',
      category: 'management',
      useCase: 'Strategy & planning',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'feature-specs',
      title: 'Requirements to Feature Specs',
      category: 'agile',
      useCase: 'Agile workflows',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'prototype',
      title: 'Prototype',
      category: 'design',
      useCase: 'Wireframing & prototyping',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'pi-planning',
      title: 'PI Planning',
      category: 'agile',
      useCase: 'Agile workflows',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1542744847-2c9e78280f2d?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'user-feedback',
      title: 'User Feedback to Insights',
      category: 'design',
      useCase: 'Research & design',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'visualize-concepts',
      title: 'Visualize Product Concepts',
      category: 'design',
      useCase: 'Ideation & brainstorming',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'weekly-update',
      title: 'Weekly Update Writer',
      category: 'meetings',
      useCase: 'Meetings & workshops',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'standup',
      title: 'Daily Standup',
      category: 'agile',
      useCase: 'Meetings & workshops',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'brainwriting',
      title: 'Brainwriting',
      category: 'design',
      useCase: 'Ideation & brainstorming',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'idea-multiplier',
      title: 'The Idea Multiplier',
      category: 'design',
      useCase: 'Ideation & brainstorming',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'customer-journey',
      title: 'Customer Journey Mapping',
      category: 'design',
      useCase: 'Research & design',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'flowchart',
      title: 'Flowchart',
      category: 'diagrams',
      useCase: 'Diagramming & mapping',
      badge: null,
      thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
    },
  ];

  const filteredTemplates = allTemplates.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' ||
      t.category === selectedCategory ||
      t.useCase === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in select-none p-4">
      {/* All templates modal */}
      <div className="w-full max-w-6xl h-[88vh] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl flex overflow-hidden border border-slate-200 dark:border-zinc-800 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-6 z-20 p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Close Modal"
        >
          <X size={20} />
        </button>

        {/* LEFT SIDEBAR NAVIGATION */}
        <aside className="w-64 bg-slate-50/70 dark:bg-zinc-950/50 border-r border-slate-200/80 dark:border-zinc-800/80 p-5 flex flex-col justify-between flex-shrink-0 overflow-y-auto">
          <div className="space-y-6">
            {/* Primary Categories */}
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 ${
                  selectedCategory === 'all'
                    ? 'bg-slate-200/80 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
                }`}
              >
                <Grid size={16} />
                <span>All templates</span>
              </button>

              <button
                onClick={() => setSelectedCategory('ai')}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                  selectedCategory === 'ai'
                    ? 'bg-slate-200/80 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                  <span>AI Accelerated</span>
                </div>
                <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-full uppercase">
                  New
                </span>
              </button>

              <button
                onClick={() => setSelectedCategory('community')}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 ${
                  selectedCategory === 'community'
                    ? 'bg-slate-200/80 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
                }`}
              >
                <Globe size={16} />
                <span>Community</span>
              </button>

              <button
                onClick={() => setSelectedCategory('team')}
                className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 bg-rose-600 text-white rounded text-[10px] font-black flex items-center justify-center">
                    S
                  </div>
                  <span>Srmap Team templates</span>
                </div>
                <HelpCircle size={14} className="text-slate-400" />
              </button>
            </div>

            {/* Use Cases Group */}
            <div>
              <div className="px-3 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                Use cases
              </div>
              <div className="space-y-0.5">
                {[
                  'Meetings & workshops',
                  'Ideation & brainstorming',
                  'Research & design',
                  'Agile workflows',
                  'Strategy & planning',
                  'Diagramming & mapping',
                  'Presentations & slides',
                  'Wireframing & prototyping',
                  'Image creation',
                ].map((uc) => (
                  <button
                    key={uc}
                    onClick={() => setSelectedCategory(uc)}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      selectedCategory === uc
                        ? 'bg-slate-200/80 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    {uc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col overflow-y-auto p-8 bg-white dark:bg-zinc-900">
          {/* Top Search Bar & Options */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex-1 relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search templates by name, category or company"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-zinc-800/80 border border-transparent focus:border-blue-500 rounded-xl text-xs text-slate-900 dark:text-white outline-none font-medium transition-all"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={showOnBoardCreation}
                onChange={(e) => setShowOnBoardCreation(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded"
              />
              <span>Show when creating a board</span>
            </label>
          </div>

          {/* AI Banner Hero */}
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
            <div className="space-y-1 max-w-xl">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Templates with AI built in
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Sidekicks and Flows ready to help you create, collaborate, and solve problems — no
                setup needed.
              </p>
            </div>
            <button
              onClick={() => setSelectedCategory('ai')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex-shrink-0"
            >
              Start with AI templates
            </button>
          </div>

          {/* Catalog Section Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">All templates</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
              <button
                onClick={() => setSelectedCategory('all')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                For you
              </button>
              <span>•</span>
              <button
                onClick={() => setSelectedCategory('all')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                View all
              </button>
            </div>
          </div>

          {/* TEMPLATE CARDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-8">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onMouseEnter={() => setHoveredTemplateId(template.id)}
                onMouseLeave={() => setHoveredTemplateId(null)}
                className="group relative bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
              >
                {/* Card Header & Thumbnail */}
                <div className="relative h-44 bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <img
                    src={template.thumbnail}
                    alt={template.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Badge */}
                  {template.badge && (
                    <span
                      className="absolute top-3 right-3 text-[10px] font-black uppercase text-white px-2 py-0.5 rounded-full shadow-sm"
                      style={{ backgroundColor: template.badgeColor || '#3b82f6' }}
                    >
                      {template.badge}
                    </span>
                  )}

                  {/* HOVER OVERLAY BUTTONS (MATCHING SCREENSHOT 5) */}
                  {hoveredTemplateId === template.id && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-4 animate-in fade-in duration-150">
                      <button
                        onClick={() => handleUseTemplate(template.id)}
                        className="w-full max-w-[160px] py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                      >
                        Use template
                      </button>
                      <button
                        onClick={() => handleUseTemplate(template.id)}
                        className="w-full max-w-[160px] py-2 bg-white/90 hover:bg-white text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all"
                      >
                        Preview
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Title & Author */}
                <div className="p-4 bg-white dark:bg-zinc-900">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-3.5 h-3.5 rounded-sm bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
                      S
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                      SyncSketch
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {template.title}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};
