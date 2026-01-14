
import React, { useState } from 'react';
import { analyzeDoseEscalation } from '../services/geminiService';

interface Subject {
  id: string;
  cohort: string;
  dose: number;
  age: number;
  sex: 'M' | 'F';
  weight: number;
  bmi: number;
  cycle: number;
  alt: number;
  ast: number;
  bilirubin: number;
  creatinine: number;
  aeGrade: number;
  dlt: boolean;
  auc?: number;
  tmax?: number;
  cmax?: number;
}

const Phase1DoseManagement: React.FC = () => {
  const [activeStep, setActiveStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Form States
  const [studyData, setStudyData] = useState({
    projectName: 'PH1-2025-AIDE',
    therArea: 'Oncology / Immunology',
    productName: 'AIDE-101 (Novel IO Agent)',
    design: '3+3',
    targetToxicityRate: 0.25,
    startDose: 0.1,
    maxDose: 10.0,
    cohortSize: 3,
    subjects: [] as Subject[]
  });

  const [newSubject, setNewSubject] = useState<Subject>({
    id: '', cohort: '1', dose: 0.1, age: 45, sex: 'M', weight: 75, bmi: 24.5, cycle: 1, 
    alt: 25, ast: 22, bilirubin: 0.8, creatinine: 0.9, aeGrade: 0, dlt: false
  });

  const configItems = [
    { id: 1, label: 'Background & Rationale', frequency: 'ONCE' },
    { id: 2, label: 'Objectives & Scope', frequency: 'ONCE' },
    { id: 3, label: 'Study Configuration', frequency: 'ONCE' },
    { id: 4, label: 'Investigational Product', frequency: 'ONCE' },
    { id: 5, label: 'Subject Data Entry', frequency: 'PER SUBJECT' },
    { id: 6, label: 'Decision Logic Rules', frequency: 'DECISION CYCLE' },
    { id: 7, label: 'AI Decision Summary', frequency: 'DECISION CYCLE' },
  ];

  const handleAddSubject = () => {
    if (!newSubject.id) return;
    setStudyData(prev => ({
      ...prev,
      subjects: [...prev.subjects, { ...newSubject }]
    }));
    // Reset for next
    setNewSubject({
      id: '', cohort: '1', dose: 0.1, age: 45, sex: 'M', weight: 75, bmi: 24.5, cycle: 1,
      alt: 25, ast: 22, bilirubin: 0.8, creatinine: 0.9, aeGrade: 0, dlt: false
    });
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeDoseEscalation(studyData);
      setAnalysisResult(result);
      setActiveStep(7);
    } catch (e) {
      alert("AI Analysis failed. Please check inputs.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Project Header */}
      <div className="bg-[#0b1622] text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500 text-[10px] font-black px-2 py-0.5 rounded text-slate-900 uppercase tracking-tighter">MIDD AI Platform</span>
            <h2 className="text-xl font-bold tracking-tight">AI Phase-1 Dose Management</h2>
          </div>
          <div className="grid grid-cols-3 gap-8 mt-4">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Protocol ID</p>
              <p className="text-sm font-bold text-slate-200">{studyData.projectName}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Target Toxicity</p>
              <p className="text-sm font-bold text-slate-200">{studyData.targetToxicityRate * 100}%</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Product</p>
              <p className="text-sm font-bold text-cyan-400">{studyData.productName}</p>
            </div>
          </div>
        </div>
        <button 
          onClick={runAnalysis}
          disabled={isAnalyzing || studyData.subjects.length === 0}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-50"
        >
          {isAnalyzing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          )}
          Analyze & Recommend
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Clinical Framework</h3>
          </div>
          <div className="flex-1">
            {configItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveStep(item.id)}
                className={`w-full text-left p-4 border-b border-slate-50 transition-all flex items-center justify-between group ${
                  activeStep === item.id ? 'bg-cyan-50 border-l-4 border-l-cyan-500' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className={`text-[11px] font-bold mb-0.5 ${activeStep === item.id ? 'text-cyan-800' : 'text-slate-700'}`}>
                    {item.id}. {item.label}
                  </div>
                  <div className={`text-[9px] font-bold uppercase tracking-tighter ${activeStep === item.id ? 'text-cyan-600/60' : 'text-slate-300'}`}>
                    {item.frequency}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-50/50 p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {activeStep === 5 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-slate-800">5. Multi-Variable Subject Ingestion</h3>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">n={studyData.subjects.length}</div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Subject ID</label>
                        <input type="text" placeholder="e.g., 001-S01" value={newSubject.id} onChange={(e) => setNewSubject({...newSubject, id: e.target.value})} className="border border-slate-200 rounded-lg p-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Cohort #</label>
                        <input type="number" value={newSubject.cohort} onChange={(e) => setNewSubject({...newSubject, cohort: e.target.value})} className="border border-slate-200 rounded-lg p-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Dose Level (mg)</label>
                        <input type="number" value={newSubject.dose} onChange={(e) => setNewSubject({...newSubject, dose: parseFloat(e.target.value)})} className="border border-slate-200 rounded-lg p-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Cycle #</label>
                        <input type="number" value={newSubject.cycle} onChange={(e) => setNewSubject({...newSubject, cycle: parseInt(e.target.value)})} className="border border-slate-200 rounded-lg p-2 text-xs" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">ALT (U/L)</label>
                        <input type="number" value={newSubject.alt} onChange={(e) => setNewSubject({...newSubject, alt: parseFloat(e.target.value)})} className="border border-slate-200 rounded-lg p-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Bilirubin (mg/dL)</label>
                        <input type="number" step="0.1" value={newSubject.bilirubin} onChange={(e) => setNewSubject({...newSubject, bilirubin: parseFloat(e.target.value)})} className="border border-slate-200 rounded-lg p-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">PK AUC (ng*h/mL)</label>
                        <input type="number" placeholder="Optional" value={newSubject.auc || ''} onChange={(e) => setNewSubject({...newSubject, auc: parseFloat(e.target.value)})} className="border border-slate-200 rounded-lg p-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">AE Grade (0-5)</label>
                        <input type="number" value={newSubject.aeGrade} onChange={(e) => setNewSubject({...newSubject, aeGrade: parseInt(e.target.value)})} className="border border-slate-200 rounded-lg p-2 text-xs" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-8 pt-6 border-t border-slate-50">
                    <label className="flex items-center gap-2 cursor-pointer bg-red-50 p-2 px-4 rounded-xl border border-red-100">
                        <input type="checkbox" checked={newSubject.dlt} onChange={(e) => setNewSubject({...newSubject, dlt: e.target.checked})} className="w-4 h-4 text-red-600 rounded" />
                        <span className="text-xs font-black text-red-600 uppercase tracking-tighter">Flag as DLT</span>
                    </label>
                    <button onClick={handleAddSubject} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all">Record Subject Findings</button>
                  </div>
                </div>

                {studyData.subjects.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">ID / Cohort</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Dose (mg)</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Liver (ALT/Bili)</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">AUC / Cycle</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-right">AE / DLT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {studyData.subjects.map((s, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3"><span className="font-bold text-slate-700">{s.id}</span> <span className="text-slate-400">| C{s.cohort}</span></td>
                            <td className="px-4 py-3 font-bold text-cyan-600">{s.dose} mg</td>
                            <td className="px-4 py-3 text-slate-500">{s.alt} / {s.bilirubin}</td>
                            <td className="px-4 py-3 text-slate-500">{s.auc || 'N/A'} <span className="text-slate-300 ml-1">Cycle {s.cycle}</span></td>
                            <td className="px-4 py-3 text-right">
                              <span className={`px-2 py-0.5 rounded font-bold mr-2 ${s.aeGrade >= 3 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>G{s.aeGrade}</span>
                              {s.dlt && <span className="text-red-600 font-black tracking-tighter uppercase underline decoration-2 underline-offset-2">DLT</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeStep === 7 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <h3 className="text-2xl font-bold text-slate-800">7. AI Dose Decision Insight</h3>
                {!analysisResult ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                    <p className="font-bold text-slate-600">Decision Algorithm Pending</p>
                    <p className="text-xs text-slate-400 mt-1">Please populate subject data in Step 5.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">Decision recommendation</h4>
                          <div className="text-3xl font-black">{analysisResult.recommendation}</div>
                        </div>
                        <div className="bg-white/10 px-4 py-2 rounded-xl text-right">
                          <div className="text-[10px] font-black text-slate-400 uppercase">Est. MTD</div>
                          <div className="text-xl font-bold text-cyan-400">{analysisResult.predictedMTD}</div>
                        </div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-sm text-slate-300 leading-relaxed italic">"{analysisResult.rationale}"</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3">Toxicity Signals</h4>
                        <ul className="space-y-2">
                          {analysisResult.safetyWarnings.map((w: string, i: number) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 shrink-0"></span>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-3">Pharmacology Actions</h4>
                        <ul className="space-y-2">
                          {analysisResult.nextSteps.map((s: string, i: number) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 shrink-0"></span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Phase1DoseManagement;
