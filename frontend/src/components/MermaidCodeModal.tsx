import React, { useMemo, useRef, useState } from 'react';
import { Copy, Check, Minimize2, AlertCircle, Sparkles } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { useUIStore } from '../store/useUIStore';
import { parseMermaid } from '../diagrams/mermaid/parseMermaid';
import { mermaidToElements, MERMAID_TEMPLATES } from '../diagrams/mermaid/mermaidToElements';
import { getShapeDef, resolvePartColors } from '../shapes/shapeLibrary';
import { routeConnector, routeMidpoint, pointsToSvgPath } from '../diagrams/connectorRouting';

interface MermaidCodeModalProps {
  onClose: () => void;
}

/**
 * Live preview of the generated diagram.
 *
 * Draws the same elements the board will receive, so what you see here is
 * exactly what gets inserted — including connector routing.
 */
const DiagramPreview: React.FC<{ elements: any[] }> = ({ elements }) => {
  const nodes = elements.filter((el) => el.type !== 'connector');
  const connectors = elements.filter((el) => el.type === 'connector');

  if (nodes.length === 0) return null;

  // Bounds must respect `points`, not just width/height: a leftward arrow has
  // negative point offsets and a positive width, so extents would be wrong.
  const xs: number[] = [];
  const ys: number[] = [];
  nodes.forEach((n) => {
    if (Array.isArray(n.points) && n.points.length >= 2) {
      for (let i = 0; i + 1 < n.points.length; i += 2) {
        xs.push(n.x + n.points[i]);
        ys.push(n.y + n.points[i + 1]);
      }
      return;
    }
    xs.push(n.x, n.x + (n.width || 0));
    ys.push(n.y, n.y + (n.height || 0));
  });

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const pad = 40;

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker id="mmd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
        </marker>
      </defs>

      {connectors.map((c) => {
        const from = byId.get(c.fromId);
        const to = byId.get(c.toId);
        if (!from || !to) return null;

        // Identical routing to the canvas, from the shared module, so the
        // preview is a faithful picture of what gets added to the board.
        const points = routeConnector(from, to, c.fromPort, c.toPort, c.routingStyle || 'elbow');
        const mid = routeMidpoint(points);
        const labelWidth = c.text ? String(c.text).length * 6.6 + 14 : 0;

        return (
          <g key={c.id}>
            <path
              d={pointsToSvgPath(points)}
              fill="none"
              stroke={c.stroke}
              strokeWidth={c.strokeWidth}
              strokeDasharray={c.strokeDash === 'dashed' ? '8 6' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#mmd-arrow)"
            />
            {c.text && (
              <>
                <rect
                  x={mid.x - labelWidth / 2}
                  y={mid.y - 10}
                  width={labelWidth}
                  height={20}
                  rx={5}
                  fill="#ffffff"
                  opacity={0.95}
                />
                <text
                  x={mid.x}
                  y={mid.y + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fontFamily="Inter, sans-serif"
                  fill="#475569"
                >
                  {c.text}
                </text>
              </>
            )}
          </g>
        );
      })}

      {nodes.map((node) => {
        // Lines and arrows carry their geometry in `points`, relative to the
        // element origin, and may be multi-segment (a self-message loops out
        // and back). Sequence diagrams emit these directly.
        if (node.type === 'line' || node.type === 'arrow') {
          const pts: number[] = node.points || [];
          if (pts.length < 4) return null;
          let d = `M ${node.x + pts[0]} ${node.y + pts[1]}`;
          for (let i = 2; i + 1 < pts.length; i += 2) {
            d += ` L ${node.x + pts[i]} ${node.y + pts[i + 1]}`;
          }
          return (
            <path
              key={node.id}
              d={d}
              fill="none"
              stroke={node.stroke}
              strokeWidth={node.strokeWidth}
              strokeDasharray={node.strokeDash === 'dashed' ? '6 5' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={node.type === 'arrow' ? 'url(#mmd-arrow)' : undefined}
            />
          );
        }

        // Standalone text (message labels) is left-, centre- or right-aligned
        // within its own box rather than centred on a shape.
        if (node.type === 'text') {
          const anchor = node.align === 'center' ? 'middle' : node.align === 'right' ? 'end' : 'start';
          const tx =
            node.align === 'center'
              ? node.x + node.width / 2
              : node.align === 'right'
                ? node.x + node.width
                : node.x;
          return (
            <text
              key={node.id}
              x={tx}
              y={node.y + (node.fontSize || 12)}
              textAnchor={anchor}
              fontSize={node.fontSize || 12}
              fontWeight={node.fontWeight === 'bold' ? 700 : 400}
              fontFamily="Inter, sans-serif"
              fill={node.stroke}
            >
              {node.text}
            </text>
          );
        }

        const def = getShapeDef(node.shapeId);
        const lines = String(node.text || '').split('\n');

        return (
          <g key={node.id}>
            {def && def.geometry.kind === 'parts' ? (
              <g transform={`translate(${node.x} ${node.y}) scale(${node.width / 100} ${node.height / 100})`}>
                {def.geometry.parts.map((part, i) => {
                  const colors = resolvePartColors(part, def, node.fill, node.stroke);
                  return (
                    <path
                      key={i}
                      d={part.d}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>
            ) : (
              // Plain rectangles, such as sequence activation bars.
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={node.type === 'rounded-rectangle' ? 8 : 0}
                fill={node.fill}
                stroke={node.stroke}
                strokeWidth={node.strokeWidth}
              />
            )}
            {node.text &&
              lines.map((line, i) => (
                <text
                  key={i}
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + (i - (lines.length - 1) / 2) * 18 + 5}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fontFamily="Inter, sans-serif"
                  fill="#0f172a"
                >
                  {line}
                </text>
              ))}
          </g>
        );
      })}
    </svg>
  );
};

export const MermaidCodeModal: React.FC<MermaidCodeModalProps> = ({ onClose }) => {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const { addElements } = useBoardStore();
  const { setSelectedElementIds, pan, zoom, setPan, setZoom } = useUIStore();

  // Re-parsed on every keystroke; the parser never throws, so this is safe.
  const { parsed, build } = useMemo(() => {
    const parsedResult = parseMermaid(code);
    return { parsed: parsedResult, build: mermaidToElements(parsedResult, 0, 0, 'preview') };
  }, [code]);

  const lineCount = Math.max(code.split('\n').length, 1);

  const handleApply = () => {
    if (build.nodeCount === 0) return;

    // Place the diagram centred in the current viewport.
    const originX = (window.innerWidth / 2 - pan.x) / zoom - build.width / 2;
    const originY = (window.innerHeight / 2 - pan.y) / zoom - build.height / 2;

    const result = mermaidToElements(parsed, Math.round(originX), Math.round(originY));
    addElements(result.elements);
    setSelectedElementIds(result.elements.map((el) => el.id));

    // Frame what was just created so it is never inserted off-screen.
    const fit = Math.min(
      (window.innerWidth - 240) / Math.max(result.width, 1),
      (window.innerHeight - 240) / Math.max(result.height, 1),
      1
    );
    setZoom(Math.max(0.1, fit));
    setPan({
      x: window.innerWidth / 2 - (originX + result.width / 2) * Math.max(0.1, fit),
      y: window.innerHeight / 2 - (originY + result.height / 2) * Math.max(0.1, fit),
    });

    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-zinc-950 flex flex-col font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-slate-200 dark:border-zinc-800 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Sparkles size={17} className="text-orange-500" />
          <span className="font-bold text-slate-900 dark:text-white">Diagram</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
            Beta
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={build.nodeCount === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {build.nodeCount === 0
              ? 'Add to board'
              : `Add to board (${build.nodeCount} shapes)`}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Minimize2 size={14} />
            Back to canvas
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Code editor */}
        <div className="w-full md:w-[420px] flex-shrink-0 md:border-r border-b md:border-b-0 border-slate-200 dark:border-zinc-800 flex flex-col min-h-0 max-h-[55%] md:max-h-none">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800/70">
            <span className="text-sm font-bold text-slate-900 dark:text-white">Mermaid</span>
            <button
              onClick={handleCopy}
              disabled={!code}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              title="Copy code"
            >
              {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
            </button>
          </div>

          {/* Line-numbered editor: a gutter kept in sync with the textarea scroll */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div
              ref={gutterRef}
              className="w-10 flex-shrink-0 py-3 text-right pr-2 bg-slate-50 dark:bg-zinc-900/60 text-[11px] leading-[1.6] font-mono text-slate-400 dark:text-zinc-600 select-none overflow-hidden"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onScroll={() => {
                if (gutterRef.current && textareaRef.current) {
                  gutterRef.current.scrollTop = textareaRef.current.scrollTop;
                }
              }}
              spellCheck={false}
              placeholder="Paste your Mermaid code"
              className="flex-1 py-3 px-3 bg-transparent text-[12px] leading-[1.6] font-mono text-slate-800 dark:text-zinc-100 outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
            />
          </div>

          {/* Starter templates */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800/70 flex-shrink-0">
            <div className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 mb-2 text-center">
              or start with a template
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {MERMAID_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setCode(template.code)}
                  className="px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parse feedback */}
          {code.trim() && parsed.errors.length > 0 && (
            <div className="px-4 py-2.5 border-t border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 flex-shrink-0 max-h-28 overflow-y-auto">
              <div className="flex items-start gap-2">
                <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                  {parsed.errors.slice(0, 4).map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                  {parsed.errors.length > 4 && <div>+{parsed.errors.length - 4} more</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="flex-1 bg-slate-50 dark:bg-zinc-900 p-4 md:p-8 min-w-0 min-h-0 flex items-center justify-center">
          {build.nodeCount === 0 ? (
            <div className="text-center max-w-sm">
              <div className="text-sm font-semibold text-slate-400 dark:text-zinc-500">
                Your diagram appears here
              </div>
              <div className="text-xs text-slate-400 dark:text-zinc-600 mt-1.5 leading-relaxed">
                Write Mermaid code on the left, or pick a template to see how it works. Every
                node becomes a real shape you can move and restyle after adding it.
              </div>
            </div>
          ) : (
            <DiagramPreview elements={build.elements as any[]} />
          )}
        </div>
      </div>
    </div>
  );
};
