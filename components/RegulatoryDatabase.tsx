
import React, { useState, useRef, useEffect } from 'react';
import { Category, Region, RegulationEntry, AnalysisResult, ImpactLevel, DatabaseFilters, AppTab } from '../types';
import { analyzeRegulation, categorizeNewEntry, syncIntelligence } from '../services/geminiService';
import { REGION_COUNTRY_MAP, ALL_COUNTRIES, COUNTRY_AUTHORITY_MAP } from '../constants';

interface DatabaseProps {
  data: RegulationEntry[];
  initialFilters?: DatabaseFilters;
  onAddEntry: (entry: RegulationEntry) => void;
  onUpdateEntry: (entry: RegulationEntry) => void;
  onTranslateRequest: (content: string) => void;
}

const generateRegTrackingId = (existingData: RegulationEntry[]): string => {
    const currentYear = new Date().getFullYear();
    const yearData = existingData.filter(d => d.trackingId?.startsWith(`REG-${currentYear}`));
    const nextNum = yearData.length + 1;
    return `REG-${currentYear}-${String(nextNum).padStart(3, '0')}`;
};

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleToggle = (option: string) => {
    const newSelected = selected.includes(option) ? selected.filter(item => item !== option) : [...selected, option];
    onChange(newSelected);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between min-w-[140px] px-3 py-2 bg-white border rounded-lg cursor-pointer ${isOpen ? 'border-cyan-500 ring-2 ring-cyan-500/10' : 'border-slate-200 hover:border-slate-300'}`}>
        <span className="text-xs font-semibold text-slate-600 truncate">{selected.length > 0 ? `${label} (${selected.length})` : label}</span>
        <svg className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-64 mt-2 bg-white border border-slate-100 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          <div className="p-2 space-y-1">
            {options.map((option) => (
              <div key={option} onClick={() => handleToggle(option)} className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-slate-50 ${selected.includes(option) ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600'}`}>
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${selected.includes(option) ? 'bg-cyan-600 border-cyan-600' : 'border-slate-300'}`}>
                  {selected.includes(option) && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                </div>
                <span className="text-xs font-medium">{option}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RegulatoryDatabase: React.FC<DatabaseProps> = ({ data, initialFilters, onAddEntry, onUpdateEntry, onTranslateRequest }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialFilters?.status || []);
  const [selectedImpacts, setSelectedImpacts] = useState<string[]>(initialFilters?.impact || []);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const [selectedItem, setSelectedItem] = useState<RegulationEntry | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEntryText, setNewEntryText] = useState('');
  const [isProcessingNewEntry, setIsProcessingNewEntry] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<RegulationEntry[]>([]);

  const filteredData = data.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || item.trackingId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category);
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(item.status);
    const matchesImpact = selectedImpacts.length === 0 || selectedImpacts.includes(item.impact);
    return matchesSearch && matchesCategory && matchesStatus && matchesImpact;
  }).sort((a, b) => sortDirection === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

  const handleAnalyze = async (item: RegulationEntry) => {
    setSelectedItem(item);
    setAnalysis(null);
    setIsAnalyzing(true);
    try {
      const result = await analyzeRegulation(item);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
        const existingTitles = data.map(d => d.title);
        const newFindings = await syncIntelligence(existingTitles);
        setSyncResults(newFindings);
    } catch (e) {
        console.error(e);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleImportSyncResult = (item: RegulationEntry) => {
    const trackingId = generateRegTrackingId(data);
    onAddEntry({ ...item, trackingId });
    setSyncResults(prev => prev.filter(r => r.id !== item.id));
  };

  const handleManualAdd = async () => {
    if (!newEntryText.trim()) return;
    setIsProcessingNewEntry(true);
    try {
        const metadata = await categorizeNewEntry(newEntryText);
        const trackingId = generateRegTrackingId(data);
        onAddEntry({
            ...metadata as RegulationEntry,
            id: Date.now().toString(),
            trackingId,
            content: newEntryText,
            status: 'Draft'
        });
        setIsAddModalOpen(false);
        setNewEntryText('');
    } catch (e) {
        alert("Extraction failed.");
    } finally {
        setIsProcessingNewEntry(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[300px]">
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search Tracking ID, GMP/GCP changes, or Title..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white transition-colors" />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <div className="flex gap-2">
                <MultiSelectDropdown label="Status" options={['Final', 'Draft', 'Consultation']} selected={selectedStatuses} onChange={setSelectedStatuses} />
                <MultiSelectDropdown label="Impact" options={['High', 'Medium', 'Low']} selected={selectedImpacts} onChange={setSelectedImpacts} />
                <button onClick={handleSyncDatabase} disabled={isSyncing} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2">
                   {isSyncing ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>}
                   Sync AI
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tracking ID</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Authority</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Impact</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 text-xs font-mono font-bold text-slate-500">{item.trackingId}</td>
                  <td className="px-4 py-3 max-w-md">
                    <div className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-cyan-600 transition-colors">{item.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.date} • {item.category}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-bold text-slate-700">{item.agency}</div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">{item.country}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      item.status === 'Final' ? 'bg-green-50 text-green-700' : 
                      item.status === 'Draft' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      item.impact === ImpactLevel.High ? 'bg-red-50 text-red-700' : 
                      item.impact === ImpactLevel.Medium ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.impact}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onTranslateRequest(item.content || item.summary)}
                          className="text-[10px] font-black text-slate-400 uppercase tracking-tighter hover:text-cyan-600"
                        >
                          Translate
                        </button>
                        <button 
                          onClick={() => handleAnalyze(item)}
                          className="text-[10px] font-black text-cyan-600 uppercase tracking-tighter hover:underline"
                        >
                          Deep Analysis
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <p className="font-bold text-slate-500">No Intelligence Found</p>
            <p className="text-xs mt-1 text-center">Adjust your filters or sync with global authorities to find updates.</p>
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-black text-cyan-400 border border-white/10">
                   {selectedItem.impact.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedItem.trackingId} Intelligence</h3>
                  <p className="text-xs text-slate-400 line-clamp-1">{selectedItem.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                    onClick={() => {
                        onTranslateRequest(selectedItem.content || selectedItem.summary);
                        setSelectedItem(null);
                    }}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black uppercase rounded-lg shadow-lg"
                 >
                    Translate Result
                 </button>
                 <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-cyan-500/20 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                  </div>
                  <div>
                    <p className="text-slate-800 font-bold text-lg">AI Senior QA Assistant</p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">Parsing Regulatory Impact Map...</p>
                  </div>
                </div>
              ) : analysis ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">AI Executive Summary</h4>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium bg-white p-5 rounded-xl border border-slate-200 shadow-sm italic">"{analysis.summary}"</p>
                  </section>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 p-5 rounded-xl border border-red-100 shadow-sm">
                      <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                         Compliance Risk
                      </h4>
                      <p className="text-xs text-red-800 font-bold leading-relaxed">{analysis.complianceRisk}</p>
                    </div>
                    <div className="bg-cyan-50 p-5 rounded-xl border border-cyan-100 shadow-sm">
                      <h4 className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                         Operational Impact
                      </h4>
                      <p className="text-xs text-cyan-800 font-bold leading-relaxed">{analysis.operationalImpact}</p>
                    </div>
                  </div>

                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Remediation Action Items</h4>
                    <div className="space-y-3">
                      {analysis.actionItems.map((a, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-xs bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-md transform hover:translate-x-1 transition-transform">
                           <div className="w-5 h-5 bg-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-[10px]">{idx+1}</div>
                           <span className="font-medium pt-0.5 leading-relaxed">{a}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegulatoryDatabase;
