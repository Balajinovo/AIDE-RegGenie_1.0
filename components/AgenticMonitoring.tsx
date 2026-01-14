
import React, { useState, useEffect } from 'react';

interface Agent {
    id: string;
    name: string;
    target: string;
    status: 'SURVEILLANCE' | 'ANALYZING' | 'REPORTING' | 'IDLE';
    health: number;
    lastSignal: string;
}

const AgenticMonitoring: React.FC = () => {
    const [agents] = useState<Agent[]>([
        { id: 'bot-1', name: 'FDA Sentinel', target: '21 CFR Part 11', status: 'SURVEILLANCE', health: 98, lastSignal: 'Checked for guidance updates' },
        { id: 'bot-2', name: 'EMA Watchdog', target: 'EudraVigilance', status: 'ANALYZING', health: 100, lastSignal: 'Processing safety signals' },
        { id: 'bot-3', name: 'TGA Monitor', target: 'AU GMP Guidelines', status: 'REPORTING', health: 95, lastSignal: 'Drafting impact report' },
        { id: 'bot-4', name: 'WHO Overseer', target: 'Global PV Standards', status: 'IDLE', health: 99, lastSignal: 'System scan complete' },
    ]);

    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            const randomAgent = agents[Math.floor(Math.random() * agents.length)];
            const actions = ['pinged endpoint', 'verified data integrity', 'scanned document', 'correlated risk'];
            const newLog = `[${new Date().toLocaleTimeString()}] ${randomAgent.name} ${actions[Math.floor(Math.random() * actions.length)]} on ${randomAgent.target}`;
            setLogs(prev => [newLog, ...prev].slice(0, 50));
        }, 3000);
        return () => clearInterval(interval);
    }, [agents]);

    return (
        <div className="flex flex-col gap-6 h-full pb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.map(agent => (
                    <div key={agent.id} className="bg-slate-900 border border-white/10 rounded-xl p-5 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 opacity-50"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Agent ID: {agent.id}</h4>
                                <div className="text-lg font-bold">{agent.name}</div>
                            </div>
                            <div className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_8px] ${
                                agent.status === 'SURVEILLANCE' ? 'bg-cyan-400 shadow-cyan-400' : 
                                agent.status === 'ANALYZING' ? 'bg-amber-400 shadow-amber-400' : 'bg-emerald-400 shadow-emerald-400'
                            }`}></div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                <span>TARGET</span>
                                <span className="text-white">{agent.target}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                <span>SYSTEM HEALTH</span>
                                <span className="text-cyan-400">{agent.health}%</span>
                            </div>
                            <div className="bg-white/5 p-2 rounded text-[10px] font-mono text-slate-400 h-10 overflow-hidden leading-relaxed italic">
                                &gt; {agent.lastSignal}...
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                <div className="lg:col-span-2 bg-slate-950 rounded-xl border border-white/10 p-6 flex flex-col shadow-2xl relative">
                    <div className="absolute top-0 right-0 p-4 flex gap-2">
                        <div className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-black uppercase border border-cyan-500/20">Surveillance Mode</div>
                    </div>
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Neural Activity Stream</h3>
                    <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-2 p-4 bg-black/40 rounded-lg border border-white/5 scrollbar-thin">
                        {logs.length === 0 ? (
                            <div className="text-slate-700 animate-pulse">Initializing Agent Pips...</div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="text-slate-400 border-l-2 border-cyan-900/50 pl-3 py-1 hover:bg-white/5 transition-colors">
                                    <span className="text-cyan-600 font-bold opacity-70">BOT_SIGNAL:</span> {log}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-6 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Automated Risk Queue</h3>
                    <div className="space-y-4 flex-1 overflow-y-auto">
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">P1 Signal</span>
                                <span className="text-[9px] font-bold text-slate-400">2m ago</span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 leading-snug">FDA Draft Guidance: Decentralized Clinical Trials (DCTs) updated.</p>
                            <p className="text-[10px] text-red-600 font-bold mt-2 uppercase tracking-widest cursor-pointer hover:underline">Launch Analysis Bot &rarr;</p>
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">System Info</span>
                                <span className="text-[9px] font-bold text-slate-400">15m ago</span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 leading-snug">EMA surveillance agent completed scan of GVP Module IX revision.</p>
                        </div>
                    </div>
                    <button className="w-full py-3 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">Deploy New Agent</button>
                </div>
            </div>
        </div>
    );
};

export default AgenticMonitoring;
