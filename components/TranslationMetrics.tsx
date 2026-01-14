
import React, { useMemo, useState, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, AreaChart, Area, PieChart, Pie
} from 'recharts';
import { TranslationLog, AppTab } from '../types';

const MetricCard = ({ title, value, subtext, icon, color }: { title: string, value: string | number, subtext: string, icon: React.ReactNode, color: string }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-start gap-4">
        <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
            {icon}
        </div>
        <div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</div>
            <div className="text-[10px] text-slate-500 mt-1 leading-tight">{subtext}</div>
        </div>
    </div>
);

const TranslationMetrics: React.FC<{ onAction: (log: TranslationLog) => void }> = ({ onAction }) => {
    const [logs, setLogs] = useState<TranslationLog[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem('aide_translation_metrics');
        if (stored) setLogs(JSON.parse(stored));
    }, []);

    const stats = useMemo(() => {
        const totalWords = logs.reduce((acc, l) => acc + l.wordCount, 0);
        const finalized = logs.filter(l => l.status === 'QC Finalized' || l.status === 'Downloaded');
        const avgYield = logs.length > 0 ? logs.reduce((acc, l) => acc + (l.qualityScore || 0), 0) / logs.length : 0;
        const totalErrors = logs.reduce((acc, l) => acc + (l.rationales?.length || 0), 0);
        return { totalWords, finalized: finalized.length, avgYield, totalErrors };
    }, [logs]);

    const chartData = useMemo(() => {
        const daily: Record<string, any> = {};
        logs.forEach(log => {
            const d = new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!daily[d]) daily[d] = { date: d, yield: 0, count: 0 };
            daily[d].yield += (log.qualityScore || 0);
            daily[d].count += 1;
        });
        return Object.values(daily).map(d => ({ ...d, yield: Math.round(d.yield / d.count) }));
    }, [logs]);

    const getYieldColor = (score?: number) => {
        if (!score) return 'text-slate-400';
        if (score >= 95) return 'text-emerald-600';
        if (score >= 85) return 'text-amber-600';
        return 'text-red-600';
    };

    return (
        <div className="flex flex-col gap-8 pb-10">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Analytical Workflow Intelligence</h2>
                    <p className="text-sm text-slate-500">Monitoring MQM-compliant translation precision and human quality verification loops.</p>
                </div>
                <button onClick={() => (window as any).setActiveTab('translation')} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase shadow-lg">New Ingestion Cycle</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="System Yield (MQM)" value={`${stats.avgYield.toFixed(1)}%`} subtext="Avg. Accuracy Precision" color="emerald" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                <MetricCard title="Error Incidence" value={stats.totalErrors} subtext="Total Intervention Count" color="amber" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} />
                <MetricCard title="Ingested Volume" value={stats.totalWords.toLocaleString()} subtext="Processed Scientific Words" color="cyan" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
                <MetricCard title="Cycle Completion" value={stats.finalized} subtext="GXp Verified Reports" color="indigo" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">Workflow Quality Log</div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4 text-left">Tracking ID / Project</th>
                                <th className="px-6 py-4 text-left">Quality Yield (MQM)</th>
                                <th className="px-6 py-4 text-left">Interventions</th>
                                <th className="px-6 py-4 text-left">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {logs.slice().reverse().map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-[11px] font-black text-slate-800">{log.projectNumber}</div>
                                        <div className="text-[9px] text-cyan-600 font-mono tracking-tighter uppercase font-black">{log.trackingId}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`text-lg font-black ${getYieldColor(log.qualityScore)}`}>{log.qualityScore || 0}%</div>
                                        <div className="text-[8px] text-slate-400 font-bold uppercase">Accuracy Score</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[11px] font-bold text-slate-700">{log.rationales?.length || 0} Points</div>
                                        <div className="text-[8px] text-slate-400 font-bold uppercase">Weighted: {log.mqmErrorScore || 0}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${log.status === 'QC Finalized' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => onAction(log)} className="bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded text-[10px] font-black uppercase shadow-sm">View Details</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TranslationMetrics;
