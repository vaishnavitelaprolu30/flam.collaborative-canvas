import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Called when the user chooses to leave the board rather than retry. */
  onLeave?: () => void;
}

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Catches render failures inside the canvas.
 *
 * Without this, a single bad element takes the whole application down to a
 * blank page with nothing on screen to explain it — the board, the toolbars and
 * the dashboard all disappear together. React only offers class components for
 * this, hence the older style.
 *
 * The boundary is deliberately scoped to the canvas: chrome outside it stays
 * usable, so you can still leave the board that failed.
 */
export class CanvasErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the component trace: it is the fastest way to find which element
    // type failed to draw.
    this.setState({ info: info.componentStack ?? null });
    console.error('[canvas] render failed:', error, info.componentStack);
  }

  private handleRetry = () => this.setState({ error: null, info: null });

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="w-full h-full flex items-center justify-center p-8 bg-slate-50 dark:bg-zinc-950">
        <div className="max-w-lg w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 font-sans">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                This board could not be drawn
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Something in the canvas failed to render. Your work is saved — this only
                affects drawing it on screen.
              </p>
            </div>
          </div>

          <pre className="mt-4 p-3 rounded-xl bg-slate-100 dark:bg-zinc-950 text-[11px] text-red-600 dark:text-red-400 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {error.message || String(error)}
          </pre>

          {info && (
            <details className="mt-2">
              <summary className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 cursor-pointer hover:text-slate-700">
                Component trace
              </summary>
              <pre className="mt-1 p-3 rounded-xl bg-slate-100 dark:bg-zinc-950 text-[10px] text-slate-500 dark:text-zinc-500 overflow-auto max-h-40">
                {info.trim()}
              </pre>
            </details>
          )}

          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={this.handleRetry}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
            >
              <RotateCcw size={14} />
              Try drawing again
            </button>
            {this.props.onLeave && (
              <button
                onClick={this.props.onLeave}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold transition-colors"
              >
                <Home size={14} />
                All boards
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
