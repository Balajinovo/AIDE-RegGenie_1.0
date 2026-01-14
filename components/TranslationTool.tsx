
import React, { useState, useRef, useEffect } from 'react';
import { translateDocument, getAlternateSuggestions } from '../services/geminiService';
import { TranslationLog, FunctionalGroup, TranslationDocType, CorrectionRationale, MQMSeverity, MQMType } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI } from "@google/genai";
import { extractRawText } from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

const generateTrackingId = (): string => {
  const existingLogsStr = localStorage.getItem('aide_translation_metrics');
  const existingLogs: TranslationLog[] = existingLogsStr ? JSON.parse(existingLogsStr) : [];
  const currentYear = new Date().getFullYear();
  const yearLogs = existingLogs.filter(l => l.trackingId.startsWith(currentYear.toString()));
  return `${currentYear}-${String(yearLogs.length + 1).padStart(3, '0')}`;
};

const LANGUAGES = [
    'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Tamil', 
    'Hindi', 'Portuguese', 'Italian', 'Russian', 'Korean', 'Arabic', 'Thai',
    'Vietnamese', 'Turkish', 'Polish', 'Dutch', 'Greek', 'Czech'
];

const TranslationTool: React.FC<{ initialText?: string }> = ({ initialText }) => {
  // Header States
  const [projectNumber, setProjectNumber] = useState('AZ-PH1-2025');
  const [currentTrackingId, setCurrentTrackingId] = useState<string>('');
  const [currentLogId, setCurrentLogId] = useState<string>('');
  const [sourceLanguage, setSourceLanguage] = useState('Detecting...');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [documentType, setDocumentType] = useState<TranslationDocType>(TranslationDocType.EssentialDocuments);
  const [initiateTranslation, setInitiateTranslation] = useState(false);

  // Content States
  const [sourcePages, setSourcePages] = useState<string[]>([]); 
  const [editedPages, setEditedPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  
  // Metrics States
  const [wordCount, setWordCount] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  // QC States
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [qcStatus, setQcStatus] = useState<'Draft' | 'QC Pending' | 'QC Finalized' | 'Downloaded'>('Draft');
  const [qcSeconds, setQcSeconds] = useState(0);
  const [rationales, setRationales] = useState<CorrectionRationale[]>([]);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  // Intervention Modal
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [selectedWordData, setSelectedWordData] = useState<{ word: string, index: number } | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [isFetchingAlts, setIsFetchingAlts] = useState(false);
  const [selectedAlt, setSelectedAlt] = useState('');
  const [mqmSeverity, setMqmSeverity] = useState<MQMSeverity>(MQMSeverity.Minor);
  const [mqmType, setMqmType] = useState<MQMType>(MQMType.Terminology);
  const [rationaleText, setRationaleText] = useState('');

  // Voice Reading States
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cost calculation constants
  const TOKEN_FACTOR = 1.35;
  const COST_PER_1M_TOKENS = 0.75; 

  // Auto-trigger translation when radio is selected
  useEffect(() => {
    if (initiateTranslation && sourcePages.length > 0 && !isLoading && editedPages.length === 0) {
        handleTranslate();
    }
  }, [initiateTranslation, sourcePages, isLoading, editedPages]);

  // Handle TTS Cleanup
  useEffect(() => {
    return () => {
        window.speechSynthesis.cancel();
    };
  }, []);

  // QC Hours Tracking
  useEffect(() => {
    let timer: any;
    if (isReviewMode && qcStatus === 'QC Pending' && !isPaused && !isWordModalOpen) {
      timer = setInterval(() => setQcSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isReviewMode, qcStatus, isPaused, isWordModalOpen]);

  // Helper to update persistent log status
  const updatePersistentStatus = (newStatus: 'Draft' | 'QC Pending' | 'QC Finalized' | 'Downloaded') => {
    const stored = localStorage.getItem('aide_translation_metrics');
    if (stored) {
      let metrics: TranslationLog[] = JSON.parse(stored);
      const idx = metrics.findIndex(m => m.id === currentLogId);
      if (idx >= 0) {
        metrics[idx].status = newStatus;
        localStorage.setItem('aide_translation_metrics', JSON.stringify(metrics));
      }
    }
  };

  const calculateMetrics = (pages: string[]) => {
    const text = pages.join(' ');
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const tokens = Math.round(words * TOKEN_FACTOR);
    const cost = (tokens / 1000000) * COST_PER_1M_TOKENS;
    
    setWordCount(words);
    setTokenCount(tokens);
    setEstimatedCost(cost);
  };

  const detectLanguage = async (text: string) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Identify the primary language of this text. Return only the language name (e.g. English, French). \n\n${text.substring(0, 500)}`,
        });
        setSourceLanguage(response.text?.trim() || 'English');
    } catch (e) { setSourceLanguage('English'); }
  };

  // --- Voice Reading Engine ---
  const handleStartReading = () => {
    const text = editedPages[currentPage];
    if (!text) return;

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const localeMap: Record<string, string> = { 
        Spanish: 'es-ES', French: 'fr-FR', Tamil: 'ta-IN', German: 'de-DE', 
        Chinese: 'zh-CN', Japanese: 'ja-JP', Korean: 'ko-KR', Arabic: 'ar-SA' 
    };
    utterance.lang = localeMap[targetLanguage] || 'en-US';
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        // Map character index to word index
        const precedingText = text.substring(0, charIndex);
        const wordIdx = precedingText.trim() === '' ? 0 : precedingText.trim().split(/\s+/).length;
        setHighlightedWordIndex(wordIdx);
      }
    };

    utterance.onend = () => {
      setIsReading(false);
      setIsPaused(false);
      setHighlightedWordIndex(null);
    };

    utteranceRef.current = utterance;
    setIsReading(true);
    setIsPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  const handlePauseReading = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleResumeReading = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else if (!isReading) {
      handleStartReading();
    }
  };

  const handleStopReading = () => {
    window.speechSynthesis.cancel();
    setIsReading(false);
    setIsPaused(false);
    setHighlightedWordIndex(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let pages: string[] = [];

    try {
        if (file.type === 'application/pdf') {
            const buffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pages.push(content.items.map((item: any) => item.str).join(' '));
            }
        } else if (file.name.endsWith('.docx')) {
            const buffer = await file.arrayBuffer();
            const result = await extractRawText({ arrayBuffer: buffer });
            pages = [result.value];
        } else {
            const text = await file.text();
            pages = [text];
        }

        setSourcePages(pages);
        calculateMetrics(pages);
        setCurrentTrackingId(generateTrackingId());
        setCurrentLogId(`trans-${Date.now()}`);
        detectLanguage(pages[0] || '');
        setInitiateTranslation(false);
        setEditedPages([]);
        setQcStatus('Draft');
    } catch (err) {
        alert("Failed to process document.");
        console.error(err);
    }
  };

  const handleTranslate = async () => {
    if (sourcePages.length === 0) return;
    setIsLoading(true);
    setProgress('Mapping Intelligence Pipeline...');
    try {
        const result = await translateDocument(sourcePages, targetLanguage, 'General', setProgress);
        const pages = Array.isArray(result) ? result : [result];
        setEditedPages(pages);
        setQcStatus('QC Pending');
        
        const log: TranslationLog = {
            id: currentLogId,
            trackingId: currentTrackingId,
            functionalGroup: FunctionalGroup.ClinicalOperations, 
            projectNumber,
            docType: documentType,
            timestamp: Date.now(),
            sourceLanguage,
            targetLanguage,
            wordCount,
            charCount: sourcePages.join('').length,
            pageCount: pages.length,
            mode: 'General',
            provider: 'Gemini-3-Flash',
            status: 'QC Pending',
            qcTimeSpentSeconds: 0,
            workflowTimeCodes: [{ event: 'START', timestamp: Date.now() }],
            estimatedCost: estimatedCost,
            rationales: []
        };
        const metrics = JSON.parse(localStorage.getItem('aide_translation_metrics') || '[]');
        localStorage.setItem('aide_translation_metrics', JSON.stringify([...metrics, log]));
    } catch (e) { 
        alert("Pipeline Failure"); 
        setInitiateTranslation(false); 
    } finally { 
        setIsLoading(false); 
        setProgress(''); 
    }
  };

  const handleWordClick = async (word: string, index: number) => {
    handlePauseReading();
    setSelectedWordData({ word: word.replace(/[.,!?;:]/g, ''), index });
    setIsWordModalOpen(true);
    setIsFetchingAlts(true);
    try {
      const alts = await getAlternateSuggestions(word, editedPages[currentPage], targetLanguage);
      setAlternatives(alts);
    } catch (e) { console.error(e); }
    finally { setIsFetchingAlts(false); }
  };

  const confirmIntervention = () => {
    if (!selectedWordData || !selectedAlt || !rationaleText) return;

    const words = editedPages[currentPage].split(/\s+/);
    words[selectedWordData.index] = selectedAlt;
    const newPageText = words.join(' ');
    
    const newPages = [...editedPages];
    newPages[currentPage] = newPageText;
    setEditedPages(newPages);

    const rationale: CorrectionRationale = {
      originalText: selectedWordData.word,
      updatedText: selectedAlt,
      rationale: rationaleText,
      timestamp: Date.now(),
      pageIndex: currentPage,
      wordIndex: selectedWordData.index,
      mqmSeverity,
      mqmType
    };

    setRationales(prev => [...prev, rationale]);

    const stored = localStorage.getItem('aide_translation_metrics');
    if (stored) {
      let metrics: TranslationLog[] = JSON.parse(stored);
      const idx = metrics.findIndex(m => m.id === currentLogId);
      if (idx >= 0) {
        const log = metrics[idx];
        log.rationales = [...(log.rationales || []), rationale];
        
        const weights = log.rationales.reduce((acc, curr) => {
          if (curr.mqmSeverity === MQMSeverity.Minor) return acc + 1;
          if (curr.mqmSeverity === MQMSeverity.Major) return acc + 5;
          return acc + 10;
        }, 0);
        
        log.mqmErrorScore = weights;
        log.qualityScore = Math.max(0, Math.round(100 * (1 - weights / log.wordCount)));
        localStorage.setItem('aide_translation_metrics', JSON.stringify(metrics));
      }
    }

    setIsWordModalOpen(false);
    setSelectedAlt('');
    setRationaleText('');
    handleResumeReading();
  };

  const handleDownloadWord = () => {
    const content = editedPages.join('\n\n');
    const blob = new Blob([`
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Translation Result</title>
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; }
        .header { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        .footer { margin-top: 30px; font-size: 10px; color: #777; border-top: 1px solid #ccc; padding-top: 5px; }
      </style>
      </head>
      <body>
        <div class="header">
          <h2>${documentType}</h2>
          <p>Tracking ID: ${currentTrackingId}</p>
          <p>Project: ${projectNumber}</p>
          <p>Target Language: ${targetLanguage}</p>
        </div>
        <div>${content.replace(/\n/g, '<br/>')}</div>
        <div class="footer">Generated by AIDE Clinical Intelligence Platform - ${new Date().toLocaleDateString()}</div>
      </body>
      </html>
    `], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentTrackingId}_Final.doc`;
    link.click();
    
    setQcStatus('Downloaded');
    updatePersistentStatus('Downloaded');
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${currentTrackingId} - Final PDF</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.5; color: #333; }
            h1 { color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 10px; }
            .meta { margin-bottom: 30px; font-size: 12px; color: #666; }
            .content { white-space: pre-wrap; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>${documentType}</h1>
          <div class="meta">
            Tracking ID: ${currentTrackingId} | Project: ${projectNumber}<br/>
            Target Language: ${targetLanguage} | Date: ${new Date().toLocaleDateString()}
          </div>
          <div class="content">${editedPages.join('\n\n')}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    
    setQcStatus('Downloaded');
    updatePersistentStatus('Downloaded');
  };

  return (
    <div className="flex flex-col h-full space-y-6">
        <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-all ${isLargeScreen ? 'hidden' : 'block'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Project Number</label>
                    <input 
                        value={projectNumber} 
                        onChange={e => setProjectNumber(e.target.value)} 
                        className="w-full border-slate-200 rounded-lg p-2.5 font-bold text-sm bg-slate-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-cyan-500/20 shadow-sm" 
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Document Type</label>
                    <select 
                        value={documentType} 
                        onChange={e => setDocumentType(e.target.value as TranslationDocType)} 
                        className="w-full border-slate-200 rounded-lg p-2.5 font-bold text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                    >
                        {Object.values(TranslationDocType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Source (Auto Identification)</label>
                    <div className="w-full bg-slate-100 rounded-lg p-2.5 font-bold text-sm text-slate-600 border border-slate-200 flex items-center justify-between">
                        <span>{sourceLanguage}</span>
                        {sourceLanguage !== 'Detecting...' && <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Target Language</label>
                    <select 
                        value={targetLanguage} 
                        onChange={e => setTargetLanguage(e.target.value)} 
                        className="w-full border-slate-200 rounded-lg p-2.5 font-bold text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                    >
                        {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Translation Tracking Number</label>
                    <div className="w-full bg-cyan-50 border border-cyan-100 rounded-lg p-2.5 font-mono text-cyan-600 font-black text-xs shadow-inner">
                        {currentTrackingId || 'AWAITING ARTIFACT'}
                    </div>
                </div>
                <div className="flex flex-col justify-end">
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="w-full bg-slate-900 text-white rounded-lg p-2.5 font-black uppercase text-[10px] hover:bg-black transition-all shadow-md active:scale-95 border-b-2 border-slate-700"
                    >
                        {sourcePages.length > 0 ? 'Change Document' : 'Upload Document'}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileUpload} />
                </div>
                
                <div className="lg:col-span-2 grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Word Count</span>
                        <span className="text-sm font-bold text-slate-700">{wordCount.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Token Processing</span>
                        <span className="text-sm font-bold text-slate-700">{tokenCount.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-cyan-600 uppercase">Estimated Price</span>
                        <span className="text-sm font-bold text-emerald-600">${estimatedCost.toFixed(4)}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-5 border-t border-slate-100">
                <div className="flex items-center gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${initiateTranslation ? 'border-cyan-500 bg-cyan-50' : 'border-slate-300'}`}>
                            {initiateTranslation && <div className="w-3 h-3 rounded-full bg-cyan-500 animate-in zoom-in-50"></div>}
                        </div>
                        <input 
                            type="radio" 
                            name="initiate" 
                            checked={initiateTranslation} 
                            onChange={() => setInitiateTranslation(true)} 
                            className="hidden" 
                        />
                        <span className={`text-xs font-black uppercase tracking-widest transition-colors ${initiateTranslation ? 'text-cyan-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                            Initiate Translation Cycle
                        </span>
                    </label>
                </div>
                <div className="flex gap-3">
                    {(qcStatus === 'QC Pending' || qcStatus === 'Draft') && isReviewMode && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100 shadow-sm">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-amber-700 uppercase">QC Active: {Math.floor(qcSeconds/60)}m {qcSeconds%60}s</span>
                        </div>
                    )}
                    {(qcStatus === 'QC Finalized' || qcStatus === 'Downloaded') && (
                        <div className="flex gap-2">
                            <button onClick={handleDownloadWord} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 shadow-lg flex items-center gap-2">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path></svg>
                                Download Word
                            </button>
                            <button onClick={handleDownloadPDF} className="bg-red-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-700 shadow-lg flex items-center gap-2">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path></svg>
                                Download PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className={`flex-1 grid grid-cols-1 ${isLargeScreen ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-6 min-h-0`}>
            <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full shadow-sm ${isLargeScreen ? 'hidden' : 'flex'}`}>
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Source Artifact View</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} className="p-1 hover:bg-white rounded text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Pg {currentPage + 1}/{sourcePages.length || 1}</span>
                        <button onClick={() => setCurrentPage(Math.min(sourcePages.length - 1, currentPage + 1))} className="p-1 hover:bg-white rounded text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>
                <div className="flex-1 p-8 overflow-y-auto whitespace-pre-wrap text-[13px] leading-loose text-slate-700 font-medium bg-slate-50/20">
                    {sourcePages[currentPage] || ""}
                </div>
            </div>

            <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full shadow-sm relative ${isLargeScreen ? 'col-span-1' : ''}`}>
                <div className="p-3 bg-cyan-50/50 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-700">Translation Output</span>
                        {editedPages.length > 0 && (
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-cyan-100">
                                <button onClick={isReading && !isPaused ? handlePauseReading : handleResumeReading} className="text-cyan-600 hover:text-cyan-800 p-0.5">
                                    {isReading && !isPaused ? (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 001.555.832l3-2z" clipRule="evenodd"></path></svg>
                                    )}
                                </button>
                                <button onClick={handleStopReading} className="text-red-400 hover:text-red-600 p-0.5">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"></path></svg>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsLargeScreen(!isLargeScreen)}
                            className="p-1.5 text-slate-400 hover:text-cyan-600 transition-colors"
                            title={isLargeScreen ? "Shrink View" : "Large Screen View"}
                        >
                            {isLargeScreen ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9L4 4m0 0l5 0m-5 0l0 5m11-1l5 5m0 0l-5 0m5 0l0-5"></path></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                            )}
                        </button>
                        <button 
                            onClick={() => setIsReviewMode(!isReviewMode)} 
                            disabled={editedPages.length === 0} 
                            className={`px-4 py-1.5 text-[10px] font-black rounded-lg border transition-all ${isReviewMode ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                        >
                            {isReviewMode ? 'PAUSE QC' : 'LAUNCH HITL QC'}
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 p-8 overflow-y-auto bg-white">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-cyan-600 gap-6 animate-pulse">
                            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">{progress}</span>
                        </div>
                    ) : (
                        <div className="leading-[2.8] text-[14px] text-slate-800 font-medium tracking-tight">
                            {editedPages[currentPage]?.trim().split(/\s+/).map((word, i) => (
                                <span 
                                    key={i} 
                                    onClick={() => isReviewMode && handleWordClick(word, i)}
                                    className={`inline-block px-1 rounded cursor-pointer transition-all duration-150 ${
                                        highlightedWordIndex === i ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.7)] scale-105 z-10' : 
                                        isReviewMode ? 'hover:bg-cyan-100 border-b border-transparent hover:border-cyan-400' : ''
                                    }`}
                                >
                                    {word}{' '}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {isReviewMode && qcStatus !== 'QC Finalized' && qcStatus !== 'Downloaded' && (
                    <div className="p-4 bg-slate-900 flex justify-between items-center text-white border-t border-white/10 shadow-2xl">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Manual Interventions</span>
                            <span className="text-[11px] font-bold text-cyan-400">{rationales.length} Points Captured</span>
                        </div>
                        <button onClick={() => { setQcStatus('QC Finalized'); updatePersistentStatus('QC Finalized'); setIsReviewMode(false); handleStopReading(); }} className="bg-emerald-600 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 active:scale-95 transition-all">Finalize Verification</button>
                    </div>
                )}
            </div>
        </div>

        {isWordModalOpen && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Semantic Intervention Window</h3>
                            <p className="text-[10px] text-slate-500 mt-1">Current Artifact Term: <span className="font-bold text-red-500 underline decoration-2">{selectedWordData?.word}</span></p>
                        </div>
                        <button onClick={() => { setIsWordModalOpen(false); handleResumeReading(); }} className="text-slate-400 hover:text-slate-600 p-2">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <div className="p-7 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intelligent Mapping Suggestions</label>
                            {isFetchingAlts ? (
                                <div className="flex gap-3 animate-pulse">
                                    {[1,2,3,4].map(i => <div key={i} className="h-11 w-28 bg-slate-100 rounded-xl" />)}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-3">
                                    {alternatives.map((alt, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => setSelectedAlt(alt)} 
                                            className={`px-5 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${selectedAlt === alt ? 'bg-cyan-600 text-white border-cyan-600 shadow-lg' : 'bg-white text-slate-600 border-slate-100 hover:border-cyan-300'}`}
                                        >
                                            {alt}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block">MQM Error Severity</label>
                                <select value={mqmSeverity} onChange={e => setMqmSeverity(e.target.value as MQMSeverity)} className="w-full border-slate-200 rounded-xl text-xs h-11 px-3 font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500/20">
                                    {Object.values(MQMSeverity).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block">MQM Taxonomy Type</label>
                                <select value={mqmType} onChange={e => setMqmType(e.target.value as MQMType)} className="w-full border-slate-200 rounded-xl text-xs h-11 px-3 font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500/20">
                                    {Object.values(MQMType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block">Technical Rationale (Model Retraining)</label>
                            <textarea 
                                value={rationaleText} 
                                onChange={e => setRationaleText(e.target.value)} 
                                className="w-full border-slate-200 rounded-2xl p-4 text-xs h-28 focus:ring-2 focus:ring-cyan-500/20 outline-none bg-slate-50 font-medium transition-all" 
                                placeholder="State the reason for this update (e.g. alignment with GxP terminology guidelines)..." 
                            />
                        </div>

                        <button 
                            onClick={confirmIntervention} 
                            disabled={!selectedAlt || !rationaleText}
                            className="w-full bg-slate-900 text-white py-4.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black disabled:opacity-30 transition-all shadow-xl active:scale-95"
                        >
                            Sync Correction & Retrain Node
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TranslationTool;
