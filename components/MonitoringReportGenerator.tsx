
import React, { useState, useRef, useEffect } from 'react';
import { synthesizeMonitoringReport } from '../services/geminiService';
import { saveMonitoringReport, getAllMonitoringReports } from '../services/dbService';
import { MonitoringReportLog } from '../types';
import { extractRawText } from 'mammoth';

type VisitTab = 'SSV' | 'SMV' | 'SCV';
type ViewMode = 'builder' | 'history';

const MonitoringReportGenerator: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('builder');
  const [activeVisit, setActiveVisit] = useState<VisitTab>('SMV');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [notesContent, setNotesContent] = useState('');
  const [notesFileName, setNotesFileName] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [currentReport, setCurrentReport] = useState<Partial<MonitoringReportLog> | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [history, setHistory] = useState<MonitoringReportLog[]>([]);

  // Metadata States
  const [projectNumber, setProjectNumber] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitNumber, setVisitNumber] = useState('');

  const excelInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const logs = await getAllMonitoringReports();
    setHistory(logs);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setTemplateFile(file);
  };

  const handleNotesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setNotesFileName(file.name);
    if (file.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        try {
          const result = await extractRawText({ arrayBuffer });
          setNotesContent(result.value);
        } catch (err) {
          alert("Failed to parse Word document.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setNotesContent(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  const runSynthesis = async () => {
    if (!notesContent.trim()) {
      alert("Please provide monitoring notes first.");
      return;
    }
    
    setIsSynthesizing(true);
    setProgressMsg('Performing Neural Analysis & Audit Mapping...');
    
    try {
      const templateInfo = templateFile 
        ? `Use structure from template: ${templateFile.name}` 
        : 'Use standard GxP clinical monitoring structure.';
        
      const metadata = { projectNumber, sponsor, visitDate, visitNumber };

      const result = await synthesizeMonitoringReport(activeVisit, notesContent, templateInfo, metadata);
      
      const fullReport: MonitoringReportLog = {
        id: `MR-${Date.now()}`,
        projectNumber,
        sponsor,
        visitDate,
        visitNumber,
        visitType: VISIT_LABELS[activeVisit],
        contentHtml: result.contentHtml || '',
        rawNotes: notesContent,
        audit: result.audit!
      };

      setCurrentReport(fullReport);
      await saveMonitoringReport(fullReport);
      await loadHistory();
    } catch (e) {
      alert("Synthesis failed. Check system logs.");
    } finally {
      setIsSynthesizing(false);
      setProgressMsg('');
    }
  };

  const VISIT_LABELS: Record<VisitTab, string> = {
    SSV: 'Site Selection Visit',
    SMV: 'Site Monitoring Visit',
    SCV: 'Site Close-out Visit'
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Sub-Navigation */}
      <div className="flex items-center justify-between bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex gap-4">
              <button 
                  onClick={() => setViewMode('builder')} 
                  className={`text-xs font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${viewMode === 'builder' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  Report Builder
              </button>
              <button 
                  onClick={() => setViewMode('history')} 
                  className={`text-xs font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${viewMode === 'history' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  Submission History ({history.length})
              </button>
          </div>
          {viewMode === 'builder' && (
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(['SSV', 'SMV', 'SCV'] as VisitTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveVisit(tab); setCurrentReport(null); }}
                    className={`py-1.5 px-4 rounded-md text-[10px] font-black uppercase transition-all ${
                      activeVisit === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
          )}
      </div>

      {viewMode === 'builder' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px]">
            {/* Input Pipeline */}
            <div className="flex flex-col gap-6">
              {/* Metadata Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  Visit Metadata
                </h3>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Project Number</label>
                      <input type="text" value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} placeholder="e.g. PRJ-102-VX" className="w-full border-slate-200 rounded-lg text-xs p-2 focus:ring-2 focus:ring-cyan-500/20 outline-none bg-slate-50" />
                   </div>
                   <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Sponsor</label>
                      <input type="text" value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="e.g. AIDE Pharma" className="w-full border-slate-200 rounded-lg text-xs p-2 focus:ring-2 focus:ring-cyan-500/20 outline-none bg-slate-50" />
                   </div>
                   <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Visit Date</label>
                      <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="w-full border-slate-200 rounded-lg text-xs p-2 focus:ring-2 focus:ring-cyan-500/20 outline-none bg-slate-50" />
                   </div>
                   <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Visit Number</label>
                      <input type="text" value={visitNumber} onChange={(e) => setVisitNumber(e.target.value)} placeholder="e.g. 05" className="w-full border-slate-200 rounded-lg text-xs p-2 focus:ring-2 focus:ring-cyan-500/20 outline-none bg-slate-50" />
                   </div>
                </div>
              </div>

              {/* Template & Notes */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col gap-6">
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    Excel Template
                  </h3>
                  <button onClick={() => excelInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 rounded-xl p-3 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all text-center group">
                    <span className="text-xs font-bold text-slate-500 group-hover:text-emerald-600">{templateFile ? templateFile.name : 'Upload Report Template (.xlsx)'}</span>
                  </button>
                  <input type="file" ref={excelInputRef} className="hidden" accept=".xlsx" onChange={handleExcelUpload} />
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                      Field Notes
                    </h3>
                    <button onClick={() => notesInputRef.current?.click()} className="text-[10px] font-black text-cyan-600 uppercase hover:underline">Import Word</button>
                    <input type="file" ref={notesInputRef} className="hidden" accept=".docx,.txt" onChange={handleNotesUpload} />
                  </div>
                  <textarea 
                    className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs font-medium focus:ring-2 focus:ring-cyan-500/20 outline-none resize-none leading-relaxed min-h-[150px]"
                    placeholder="Paste monitoring notes..."
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                  />
                </div>

                <button 
                  onClick={runSynthesis}
                  disabled={isSynthesizing || !notesContent || !projectNumber}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-[0.15em] shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
                >
                  {isSynthesizing ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
                  {isSynthesizing ? 'Extracting Intelligence...' : `Generate ${activeVisit} Submission`}
                </button>
              </div>
            </div>

            {/* Output Preview */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GXP Submission Artifact</h3>
                {currentReport && (
                  <div className="flex gap-2">
                    <button onClick={() => window.print()} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase hover:bg-black transition-all shadow-sm">Export PDF</button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-10 bg-slate-200/30">
                {isSynthesizing ? (
                  <div className="h-full flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-cyan-100 rounded-full"></div>
                      <div className="w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    </div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-widest">{progressMsg}</p>
                  </div>
                ) : currentReport ? (
                  <div className="space-y-6">
                    <div className="bg-white shadow-2xl p-12 rounded-sm prose prose-sm max-w-none prose-slate">
                      <style>{`
                        .risk-highlight { border-left: 4px solid #ef4444; background: #fef2f2; padding: 1rem; margin: 1rem 0; border-radius: 0 8px 8px 0; font-weight: 500; }
                        .trend-highlight { border-left: 4px solid #0891b2; background: #ecfeff; padding: 1rem; margin: 1rem 0; border-radius: 0 8px 8px 0; font-weight: 500; }
                      `}</style>
                      <div dangerouslySetInnerHTML={{ __html: currentReport.contentHtml || '' }} />
                      
                      {/* Audit Hub Integration */}
                      <div className="mt-12 pt-8 border-t-2 border-slate-100 no-print">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Audit & Traceability Hub</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <span className="text-[9px] font-black text-cyan-600 uppercase mb-1 block">Explainability (Rationale)</span>
                                  <p className="text-[10px] text-slate-600 leading-relaxed italic">"{currentReport.audit?.explainability}"</p>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <span className="text-[9px] font-black text-cyan-600 uppercase mb-1 block">Traceability Mapping</span>
                                  <p className="text-[10px] text-slate-600 leading-relaxed italic">"{currentReport.audit?.traceability}"</p>
                              </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                              <span>Model Accuracy: <span className="text-emerald-500 font-black">{currentReport.audit?.modelAccuracy}%</span></span>
                              <span>Trace-ID: {currentReport.id}</span>
                          </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-40">
                    <p className="font-black uppercase tracking-widest text-[10px]">Ready for Intelligence Synthesis</p>
                  </div>
                )}
              </div>
            </div>
          </div>
      ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Submission Audit Log</h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
                          <tr>
                              <th className="px-6 py-4">Submission ID</th>
                              <th className="px-6 py-4">Project / Sponsor</th>
                              <th className="px-6 py-4">Visit Info</th>
                              <th className="px-6 py-4">Audit Trace</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {history.length === 0 ? (
                              <tr>
                                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No historical submissions detected in database.</td>
                              </tr>
                          ) : history.map(report => (
                              <tr key={report.id} className="hover:bg-slate-50 transition-colors text-[11px]">
                                  <td className="px-6 py-4 font-mono font-bold text-slate-500">{report.id}</td>
                                  <td className="px-6 py-4">
                                      <div className="font-bold text-slate-800">{report.projectNumber}</div>
                                      <div className="text-slate-400 text-[10px]">{report.sponsor}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="font-bold text-cyan-600">{report.visitType} #{report.visitNumber}</div>
                                      <div className="text-slate-400 text-[10px]">{report.visitDate}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${report.audit.modelAccuracy > 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                          {report.audit.modelAccuracy}% ACC
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      <button 
                                          onClick={() => { setCurrentReport(report); setViewMode('builder'); }}
                                          className="text-cyan-600 font-black uppercase hover:underline tracking-tighter"
                                      >
                                          View Artifact
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};

export default MonitoringReportGenerator;
