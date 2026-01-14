
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { RegulationEntry, NewsItem, DatabaseFilters, ImpactLevel, Region, Category } from '../types';
import { getRegulatoryNews, getArchivedRegulatoryNews } from '../services/geminiService';

const NewsSkeleton = () => (
    <div className="space-y-6">
        {Array(3).fill(0).map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
                <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-full"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
        ))}
    </div>
);

const KpiCard = ({ title, value, icon, color, onClick, badge }: { title: string, value: string | number, icon: React.ReactNode, color: string, onClick: () => void, badge?: string }) => (
    <div className={`relative w-full p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-5 hover:shadow-lg transition-all duration-300 text-left overflow-hidden group`}>
        {badge && <span className="absolute top-0 right-0 px-2 py-1 bg-cyan-600 text-white text-[8px] font-black uppercase tracking-tighter rounded-bl-lg">{badge}</span>}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-${color}-100 text-${color}-600 flex-shrink-0 group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <div>
            <div className="text-3xl font-bold text-slate-800">{value}</div>
            <div className="text-sm font-medium text-slate-500">{title}</div>
        </div>
    </div>
);

interface DashboardProps {
    data: RegulationEntry[];
    onNavigate: (filters: DatabaseFilters) => void;
    onAddEntry: (entry: RegulationEntry) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, onNavigate, onAddEntry }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [archivedNews, setArchivedNews] = useState<NewsItem[]>([]);
    const [isLiveLoading, setIsLiveLoading] = useState(true);
    const [isArchivedLoading, setIsArchivedLoading] = useState(true);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchLiveNews = useCallback(async () => {
        setIsLiveLoading(true);
        setFeedError(null);
        try {
            const live = await getRegulatoryNews();
            setNews(live || []);
        } catch (error: any) {
            setFeedError("Failed to fetch surveillance data.");
        } finally {
            setIsLiveLoading(false);
            setLastUpdated(new Date());
        }
    }, []);

    const fetchArchivedNews = useCallback(async () => {
        setIsArchivedLoading(true);
        try {
            const archived = await getArchivedRegulatoryNews();
            setArchivedNews(archived || []);
        } catch (error) {
            console.error("Failed to fetch archived news", error);
        } finally {
            setIsArchivedLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveNews();
        fetchArchivedNews();
    }, [fetchLiveNews, fetchArchivedNews]);

    const kpiData = useMemo(() => {
        const highImpact = data.filter(r => r.impact === ImpactLevel.High).length;
        const total = data.length;
        const recent = data.filter(r => {
             const d = new Date(r.date);
             const now = new Date();
             return Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) <= 30;
        }).length;
        return { highImpact, total, recent };
    }, [data]);

    return (
        <div className="flex flex-col gap-6 h-full overflow-y-auto pb-8">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <KpiCard 
                    title="Critical Findings" 
                    value={kpiData.highImpact} 
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
                    color="red"
                    onClick={() => {}}
                 />
                 <KpiCard 
                    title="Intelligence Records" 
                    value={kpiData.total} 
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>}
                    color="indigo"
                    badge="DB LIVE"
                    onClick={() => {}}
                 />
                 <KpiCard 
                    title="New (30 Days)" 
                    value={kpiData.recent} 
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                    color="cyan"
                    onClick={() => {}} 
                 />
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 space-y-6">
                     <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[500px] overflow-hidden">
                         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                             <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                                <h3 className="font-bold text-sm">Real-time Global Surveillance</h3>
                             </div>
                             <div className="flex items-center gap-1.5">
                                 <span className="relative flex h-2 w-2">
                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                   <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                 </span>
                                 <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Monitoring Authorities</span>
                             </div>
                         </div>
                         <div className="p-6 flex-1 overflow-y-auto max-h-[800px] bg-slate-50/30">
                             {isLiveLoading ? (
                                 <div className="space-y-4">
                                     <div className="text-xs text-cyan-600 font-bold animate-pulse">Initializing surveillance link...</div>
                                     <NewsSkeleton />
                                 </div>
                             ) : (
                                 <div className="space-y-6">
                                     {news.map((item, index) => (
                                         <div key={index} className="flex flex-col gap-1 group bg-white p-4 rounded-xl border border-slate-200 hover:border-cyan-500/50 shadow-sm transition-all">
                                             <div className="flex justify-between items-start">
                                                <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-800 hover:text-cyan-600 transition-colors">{item.title}</a>
                                             </div>
                                             <p className="text-xs text-slate-500 leading-relaxed mt-1">{item.summary}</p>
                                             <div className="flex gap-2 mt-3 items-center">
                                                 <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black border border-slate-200">{item.source}</span>
                                                 <span className="text-[10px] text-slate-400">{item.date}</span>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                     </div>
                 </div>

                 <div className="space-y-6">
                     <div className="bg-slate-900 rounded-xl shadow-xl p-6 text-white border border-white/5 relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full -mr-16 -mt-16"></div>
                         <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                             <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                             Surveillance Sync
                         </h3>
                         <p className="text-xs text-slate-400 mb-4 leading-relaxed">System automatically correlating latest global GMP, GCP, and PV changes against active clinical protocols.</p>
                         <div className="w-full py-3 bg-slate-800 text-cyan-400 rounded-lg text-xs font-black uppercase tracking-widest text-center border border-white/10">
                             Active Monitor: ON
                         </div>
                     </div>

                     <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[480px]">
                         <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                             <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest">Global Milestones</h3>
                         </div>
                         <div className="p-4 flex-1 overflow-y-auto">
                              {isArchivedLoading ? <NewsSkeleton /> : (
                                  <div className="space-y-4">
                                      {archivedNews.slice(0, 8).map((item, i) => (
                                          <div key={i} className="flex items-start gap-3 border-b border-slate-50 last:border-0 pb-3 last:pb-0 group">
                                              <div className="text-[10px] font-black text-slate-300 w-16 text-right tabular-nums">{item.date}</div>
                                              <div className="flex-1">
                                                  <div className="text-xs font-bold text-slate-700 leading-snug group-hover:text-cyan-600 transition-colors">{item.title}</div>
                                                  <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 block">{item.source}</span>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                         </div>
                     </div>
                 </div>
             </div>
        </div>
    );
};

export default Dashboard;
