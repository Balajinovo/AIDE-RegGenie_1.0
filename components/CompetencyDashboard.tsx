
import React, { useMemo, useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, AreaChart, Area, PieChart, Pie
} from 'recharts';
import { GenieFeedback } from '../types';

const MetricCard = ({ title, value, subtext, icon, color }: { title: string, value: string | number, subtext: string, icon: React.ReactNode, color: string }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-start gap-4">
        <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
            {icon}
        </div>
        <div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</div>
            <div className="text-[10px] text-slate-500 mt-1 leading-tight">{subtext}</div>
        </div>
    </div>
);

const CompetencyDashboard: React.FC = () => {
    const [feedback, setFeedback] = useState<GenieFeedback[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem('aide_genie_feedback');
        if (stored) {
            setFeedback(JSON.parse(stored));
        } else {
            // Seed sample data if empty
            const sample: GenieFeedback[] = [
                { id: '1', rating: 5, comment: 'Excellent GCP guidance on decentralized trials.', timestamp: Date.now() - 86400000 * 3, querySnippet: 'What are the GCP requirements for decentralized trials?', responseSnippet: 'As per ICH E6(R3)...', topic: 'GCP' },
                { id: '2', rating: 4, comment: 'Good GMP summary for sterile manufacturing.', timestamp: Date.now() - 86400000 * 2, querySnippet: 'Summary of Annex 1 sterile manufacturing updates?', responseSnippet: 'The key changes include...', topic: 'GMP' },
                { id: '3', rating: 3, comment: 'PV citations could be more specific.', timestamp: Date.now() - 86400000 * 1, querySnippet: 'Reporting timelines for serious adverse events in EU?', responseSnippet: 'Under GVP Module VI...', topic: 'PV' },
                { id: '4', rating: 5, comment: 'Perfect breakdown of computer system validation.', timestamp: Date.now() - 3600000, querySnippet: 'CSV requirements for cloud systems?', responseSnippet: 'As per 21 CFR Part 11 and GAMP 5...', topic: 'GMP' }
            ];
            setFeedback(sample);
            localStorage.setItem('aide_genie_feedback', JSON.stringify(sample));
        }
    }, []);

    const stats = useMemo(() => {
        const totalQueries = feedback.length;
        const avgRating = feedback.reduce((acc, f) => acc + f.rating, 0) / (totalQueries || 1);
        
        const topics: Record<string, number> = {};
        feedback.forEach(f => {
            const t = f.topic || 'General';
            topics[t] = (topics[t] || 0) + 1;
        });

        const mostQueried = Object.entries(topics).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        const qualityIndex = (avgRating / 5) * 100;
        
        // Mocking a 'Grounding Index' - percentage of responses with high-quality citations
        const groundingIndex = Math.min(100, Math.round((avgRating / 5) * 92)); 

        return { totalQueries, avgRating, mostQueried, qualityIndex, topics, groundingIndex };
    }, [feedback]);

    const chartData = useMemo(() => {
        const topicData = Object.entries(stats.topics).map(([name, value]) => ({ name, value }));
        
        const daily: Record<string, any> = {};
        feedback.forEach(f => {
            const d = new Date(f.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!daily[d]) daily[d] = { date: d, count: 0, rating: 0 };
            daily[d].count += 1;
            daily[d].rating += f.rating;
        });

        const trendData = Object.values(daily).map(d => ({
            ...d,
            rating: Number((d.rating / d.count).toFixed(1))
        }));

        return { topicData, trendData };
    }, [feedback, stats]);

    const COLORS = ['#0891b2', '#0e7490', '#155e75', '#164e63'];

    return (
        <div className="flex flex-col gap-8 pb-10">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-1">GxP Genie Intelligence Analysis</h2>
                <p className="text-sm text-slate-500">Monitoring organizational knowledge seeking, model precision, and system grounding coverage.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Total Intelligence Queries" 
                    value={stats.totalQueries} 
                    subtext="Cumulative Genie query cycles"
                    color="slate"
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>}
                />
                <MetricCard 
                    title="Avg. Quality Score" 
                    value={`${stats.avgRating.toFixed(1)} / 5`} 
                    subtext="User-vetted precision index"
                    color="emerald"
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                />
                <MetricCard 
                    title="Citation Grounding" 
                    value={`${stats.groundingIndex}%`} 
                    subtext="Responses with verified sources"
                    color="cyan"
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
                />
                <MetricCard 
                    title="Learning Velocity" 
                    value={`${(stats.totalQueries / Math.max(1, feedback.length)).toFixed(1)}x`} 
                    subtext="Feedback ingestion frequency"
                    color="amber"
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Knowledge Seeking distribution (By Topic)</h3>
                    <div className="h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.topicData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.topicData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col gap-2 ml-4">
                            {chartData.topicData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-xs font-bold text-slate-600 uppercase">{entry.name}: {entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Intelligence Stability Trend</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData.trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="rating" stroke="#0891b2" strokeWidth={3} dot={{ fill: '#0891b2', r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Intelligence QC Log</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Genie Cycle</th>
                                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Query Preview</th>
                                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Precision</th>
                                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Learning Capture</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {feedback.slice().reverse().map((f) => (
                                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-[11px] font-bold text-slate-700">{f.topic || 'General'}</div>
                                            <div className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">{new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-[10px] text-slate-600 line-clamp-1 italic">"{f.querySnippet}"</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex gap-0.5">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <svg key={s} className={`w-3 h-3 ${s <= f.rating ? 'text-cyan-500 fill-cyan-500' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-[11px] font-medium text-slate-700">{f.comment}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompetencyDashboard;
