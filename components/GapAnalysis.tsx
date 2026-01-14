
import React, { useState, useRef, useMemo } from 'react';
import { generateGapAnalysis } from '../services/geminiService';
import { GapAnalysisResult, RegulationEntry } from '../types';
import { extractRawText } from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

interface GapAnalysisProps {
  regulations: RegulationEntry[];
}

const GapAnalysis: React.FC<GapAnalysisProps> = ({ regulations }) => {
  // Input States
  const [sopContent, setSopContent] = useState('');
  const [sopFileName, setSopFileName] = useState('');
  
  const [regulationContent, setRegulationContent] = useState('');
  const [selectedRegulationId, setSelectedRegulationId] = useState('');
  const [regulationSource, setRegulationSource] = useState<'upload' | 'database'>('upload');
  const [regulationFileName, setRegulationFileName] = useState('');

  // Processing States
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<GapAnalysisResult | null>(null);

  const sopInputRef = useRef<HTMLInputElement>(null);
  const regInputRef = useRef<HTMLInputElement>(null);

  // Memoized selected regulation URL
  const activeRegulationUrl = useMemo(() => {
    if (regulationSource === 'database' && selectedRegulationId) {
        return regulations.find(r => r.id === selectedRegulationId)?.url;
    }
    return undefined;
  }, [regulationSource, selectedRegulationId, regulations]);

  // --- File Handling Helpers ---
  const handleFileRead = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
         const reader = new FileReader();
         reader.onload = async (event) => {
             const buffer = event.target?.result as ArrayBuffer;
             try {
                 const loadingTask = pdfjsLib.getDocument({ data: buffer });
                 const pdf = await loadingTask.promise;
                 let extractedText = '';
                 
                 for (let i = 1; i <= pdf.numPages; i++) {
                     const page = await pdf.getPage(i);
                     const textContent = await page.getTextContent();
                     const pageStr = textContent.items.map((item: any) => item.str).join(' ');
                     extractedText += pageStr + '\n\n';
                 }
                 resolve(extractedText);
             } catch (error) {
                 console.error("Error extracting PDF text", error);
                 reject("Failed to parse PDF. Please ensure it is not password protected.");
             }
         };
         reader.readAsArrayBuffer(file);
         return;
      }
      
      if (file.name.endsWith('.docx')) {
         const reader = new FileReader();
         reader.onload = async (event) => {
             const arrayBuffer = event.target?.result as ArrayBuffer;
             try {
                 const result = await extractRawText({ arrayBuffer });
                 resolve(result.value);
             } catch (err) {
                 reject(err);
             }
         };
         reader.readAsArrayBuffer(file);
      } else {
         // Text files
         const reader = new FileReader();
         reader.onload = (e) => resolve(e.target?.result as string);
         reader.readAsText(file);
      }
    });
  };

  const handleSopUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const text = await handleFileRead(file);
          setSopContent(text);
          setSopFileName(file.name);
      } catch (e) {
          console.error(e);
          alert("Error reading file. Please try again.");
      }
  };

  const handleRegulationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const text = await handleFileRead(file);
          setRegulationContent(text);
          setRegulationFileName(file.name);
      } catch (e) {
          console.error(e);
          alert("Error reading file. Please try again.");
      }
  };

  const handleDbRegulationSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedRegulationId(id);
      const reg = regulations.find(r => r.id === id);
      if (reg) {
          setRegulationContent(`Title: ${reg.title}\nAgency: ${reg.agency}\nSummary: ${reg.summary}\n\nContent:\n${reg.content}`);
      }
  };

  const runAnalysis = async () => {
      if (!sopContent.trim() || !regulationContent.trim()) {
          alert("Please provide both an Internal SOP and a Target Regulation.");
          return;
      }

      setIsLoading(true);
      setAnalysisResult(null);
      try {
          const result = await generateGapAnalysis(sopContent, regulationContent);
          setAnalysisResult(result);
      } catch (error) {
          alert("Analysis failed. Please check your inputs.");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Regulatory Gap Analysis</h2>
            <p className="text-sm text-slate-500">
                Compare internal Standard Operating Procedures (SOPs) against specific regulations to identify gaps, non-compliance, and required remediation.
            </p>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
            {/* Left: Internal SOP */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                    <div className="flex flex-col">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs">1</span>
                            Internal SOP Ingestion
                        </h3>
                        <a 
                            href="https://sharepoint.com/sites/clinical-knowledge-base" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[10px] font-bold text-blue-500 hover:underline mt-1 flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M1.3 0H24v24H0V1.3L1.3 0zm10.5 20.3V3.7l-7.9 4.3v8l7.9 4.3zm9 0V3.7l-7.9 4.3v8l7.9 4.3z"/></svg>
                            Open SharePoint Repository
                        </a>
                    </div>
                    <div className="flex gap-2">
                        <button 
                           onClick={() => sopInputRef.current?.click()}
                           className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded font-medium transition-colors"
                        >
                            Upload File
                        </button>
                        <input type="file" ref={sopInputRef} className="hidden" accept=".pdf,.docx,.txt,.md" onChange={handleSopUpload} />
                        {sopContent && <button onClick={() => {setSopContent(''); setSopFileName('')}} className="text-xs text-red-500 hover:underline">Clear</button>}
                    </div>
                </div>
                <div className="flex-1 relative">
                    {sopFileName && (
                        <div className="absolute top-2 right-2 bg-blue-50 text-blue-700 text-[10px] px-2 py-1 rounded border border-blue-100 font-bold z-10">
                            {sopFileName}
                        </div>
                    )}
                    <textarea 
                        className="w-full h-full p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none font-mono"
                        placeholder="Paste SOP text here or upload a file (PDF, Docx)..."
                        value={sopContent}
                        onChange={(e) => setSopContent(e.target.value)}
                    ></textarea>
                </div>
            </div>

            {/* Right: Target Regulation */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                         <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded flex items-center justify-center text-xs">2</span>
                         Target Regulation
                    </h3>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg">
                        <button 
                            onClick={() => setRegulationSource('upload')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${regulationSource === 'upload' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}
                        >
                            Upload/Paste
                        </button>
                        <button 
                            onClick={() => setRegulationSource('database')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${regulationSource === 'database' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}
                        >
                            Database
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col relative">
                    {regulationSource === 'database' && (
                        <div className="mb-2">
                            <select 
                                className="w-full text-sm border-slate-200 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-slate-50"
                                value={selectedRegulationId}
                                onChange={handleDbRegulationSelect}
                            >
                                <option value="">-- Select a Regulation from DB --</option>
                                {regulations.map(r => (
                                    <option key={r.id} value={r.id}>{r.agency} - {r.title.substring(0, 50)}...</option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    {regulationSource === 'upload' && (
                        <div className="absolute top-2 right-2 z-10">
                             <button 
                                onClick={() => regInputRef.current?.click()}
                                className="text-xs bg-white/80 backdrop-blur border border-slate-200 hover:bg-slate-50 text-slate-600 px-2 py-1 rounded font-medium shadow-sm"
                             >
                                Upload File
                             </button>
                             <input type="file" ref={regInputRef} className="hidden" accept=".pdf,.docx,.txt,.md" onChange={handleRegulationUpload} />
                        </div>
                    )}

                    <textarea 
                        className="w-full h-full p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none font-mono"
                        placeholder={regulationSource === 'database' ? "Select a regulation above..." : "Paste Regulation text here or upload PDF/Docx..."}
                        value={regulationContent}
                        onChange={(e) => setRegulationContent(e.target.value)}
                        readOnly={regulationSource === 'database'}
                    ></textarea>
                </div>
            </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-center">
             <button 
                onClick={runAnalysis}
                disabled={isLoading || !sopContent || !regulationContent}
                className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 transition-transform hover:scale-105 active:scale-95"
             >
                {isLoading ? (
                    <>
                       <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                       Running Analysis...
                    </>
                ) : (
                    <>
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                       Perform Gap Analysis
                    </>
                )}
             </button>
        </div>

        {/* Results Section */}
        {analysisResult && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-10">
                {/* Summary Card */}
                <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Gap Analysis Report</h3>
                            <p className="text-slate-500 text-sm mt-1">Compliance Status Overview</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compliance Score</div>
                                <div className={`text-3xl font-black ${analysisResult.complianceScore >= 90 ? 'text-emerald-600' : analysisResult.complianceScore >= 70 ? 'text-amber-500' : 'text-red-600'}`}>
                                    {analysisResult.complianceScore}%
                                </div>
                            </div>
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${analysisResult.complianceScore >= 90 ? 'border-emerald-200 bg-emerald-50' : analysisResult.complianceScore >= 70 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                                <span className={`text-2xl ${analysisResult.complianceScore >= 90 ? 'text-emerald-600' : analysisResult.complianceScore >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {analysisResult.complianceScore >= 90 ? 'A' : analysisResult.complianceScore >= 70 ? 'B' : 'C'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-slate-700 leading-relaxed font-medium">
                            {analysisResult.executiveSummary}
                        </p>
                        {activeRegulationUrl && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <a href={activeRegulationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-black text-cyan-600 uppercase tracking-tighter hover:underline">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                    View Full Source Regulation Document
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Missing Elements */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-red-50 rounded-t-xl">
                            <h3 className="font-bold text-red-800 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                Missing Requirements
                            </h3>
                        </div>
                        <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                            {analysisResult.missingElements.length === 0 ? (
                                <div className="text-center py-8 text-emerald-600 font-medium">No missing elements detected!</div>
                            ) : (
                                analysisResult.missingElements.map((item, idx) => (
                                    <div key={idx} className="p-3 border border-red-100 rounded-lg bg-red-50/30">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded uppercase">{item.severity}</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 mb-1">Requirement: {item.requirement}</p>
                                        <p className="text-sm text-slate-600 italic">Gap: {item.gap}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Remediation Plan */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-emerald-50 rounded-t-xl">
                            <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                                Remediation Action Plan
                            </h3>
                        </div>
                        <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                            {analysisResult.remediationPlan.map((item, idx) => (
                                <div key={idx} className="p-4 border border-emerald-100 rounded-lg bg-emerald-50/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`w-2 h-2 rounded-full ${item.priority === 'High' ? 'bg-red-500' : item.priority === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                                        <span className="text-xs font-bold text-slate-500 uppercase">{item.priority} Priority</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 mb-2">{item.action}</p>
                                    {item.suggestedText && (
                                        <div className="bg-white p-3 rounded border border-slate-200 text-xs font-mono text-slate-600">
                                            <span className="block text-[10px] text-slate-400 uppercase mb-1 font-sans font-bold">Suggested Text Insert:</span>
                                            "{item.suggestedText}"
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default GapAnalysis;
