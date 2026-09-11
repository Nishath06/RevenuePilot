import React, { useEffect, useState } from 'react';
import { GitCommit, Filter, RefreshCw, ChevronDown, ChevronRight, Zap, Server, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { automationAPI } from '../services/api';

export interface TimelineStep {
  id: string;
  step: string;
  source: string;
  timestamp: string;
  severity: string;
  trace_id: string;
  execution_mode: string;
  latency_ms: number;
  details: Record<string, any>;
}

export const EventTimeline: React.FC = () => {
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTimeline = async (category: string) => {
    setLoading(true);
    try {
      const res = await automationAPI.timeline(category === 'All' ? undefined : category);
      setTimeline(res.data.timeline || []);
    } catch (err) {
      console.error('Failed to fetch timeline', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline(selectedCategory);
  }, [selectedCategory]);

  const categories = ['All', 'Inventory', 'Recovery', 'Revenue', 'AWS', 'System'];

  const getSeverityBadge = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 p-5 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-indigo-400" />
            Automation Execution Timeline (Step Functions View)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Traceable step-by-step business events and cloud execution telemetry.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => fetchTimeline(selectedCategory)}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 ml-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 shadow-xl relative backdrop-blur-md">
        <div className="relative border-l-2 border-slate-800 ml-4 space-y-6">
          {timeline.map((step) => {
            const isExpanded = expandedId === step.id;

            return (
              <div key={step.id} className="relative pl-6">
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center shadow-lg shadow-indigo-500/50" />

                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 transition-all hover:border-slate-700">
                  <div
                    className="flex flex-col md:flex-row justify-between md:items-center gap-2 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : step.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{step.step}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getSeverityBadge(step.severity)}`}>
                            {step.severity}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                          <span>Source: <strong className="text-slate-200">{step.source}</strong></span>
                          <span>Mode: <strong className="text-indigo-400">{step.execution_mode}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span className="font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {step.latency_ms}ms
                      </span>
                      <span className="font-mono text-slate-500">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Payload Accordion */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                          Trace ID: {step.trace_id}
                        </span>
                      </div>
                      <pre className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-indigo-300 font-mono text-[11px] overflow-x-auto">
                        {JSON.stringify(step.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
