
import React, { useState, useRef, useEffect } from 'react';
import { translateDocument, getAlternateSuggestions } from '../services/geminiService';
import { TranslationLog, FunctionalGroup, TranslationDocType, TranslationDimension, CorrectionRationale, MQMSeverity, MQMType } from '../types';
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
  // --- Header Configuration States ---
  const [projectNumber, setProjectNumber] = useState('AZ-PH1-2025');
  const [currentTrackingId, setCurrentTrackingId] = useState<string>('');
  const [currentLogId, setCurrentLogId] = useState<string>('');
  const [sourceLanguage, setSourceLanguage] = useState('Detecting...');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [documentType, setDocumentType] = useState<TranslationDocType>(TranslationDocType.EssentialDocuments);
  const [dimension, setDimension] = useState<TranslationDimension>(TranslationDimension.MedicalAccuracy);
  const [culturalNuances, setCulturalNuances] = useState(false);
  const [initiateTranslation, setInitiateTranslation] = useState(false);

  // --- Content & Independent Pagination States ---
  const [sourcePages, setSourcePages] = useState<string[]>([]); 
  const [sourceCurrentPage, setSourceCurrentPage] = useState(0);

  const [editedPages, setEditedPages] = useState<string[]>([]);
  const [outputCurrentPage, setOutputCurrentPage] = useState(0);
  
  // --- UI Layout States ---
  const [isOutputEnlarged, setIsOutputEnlarged] = useState(false);
  const [isSourceEnlarged, setIsSourceEnlarged] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // --- Metrics & QC States ---
  const [wordCount, setWordCount] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [qcStatus, setQcStatus] = useState<'Draft' | 'QC Pending' | 'QC Finalized' | 'Downloaded'>('Draft');
  const [qcSeconds, setQcSeconds] = useState(0);
  const [qcReviewerName, setQcReviewerName] = useState('');

  // --- Intervention Modal States ---
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [selectedWordData, setSelectedWordData] = useState<{ word: string, index: number } | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [isFetchingAlts, setIsFetchingAlts] = useState(false);
  const [selectedAlt, setSelectedAlt] = useState('');
  const [mqmSeverity, setMqmSeverity] = useState<MQMSeverity>(MQMSeverity.Minor);
  const [mqmType, setMqmType] = useState<MQMType>(MQMType.Terminology);
  const [rationaleText, setRationaleText] = useState('');

  // --- Neural Voice Reading States ---
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number | null>(null);
  const [lastCharIndex, setLastCharIndex] = useState(0);
  const speechIntervalRef = useRef<any>(null);

  // --- Loader States ---
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TOKEN_FACTOR = 1.35;
  const COST_PER_1M_TOKENS = 0.75; 

  // --- Lifecycle & Side Effects ---
  useEffect(() => {
    if (initiateTranslation && sourcePages.length > 0 && !isLoading && editedPages.length === 0) {
        handleTranslate();
    }
  }, [initiateTranslation, sourcePages, isLoading, editedPages]);

  useEffect(() => {
    window.speechSynthesis.getVoices();
    return () => {
        window.speechSynthesis.cancel();
        if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    let timer: any;
    if (isReviewMode && (qcStatus === 'QC Pending' || qcStatus === 'Draft') && !isPaused && !isWordModalOpen) {
      timer = setInterval(() => setQcSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isReviewMode, qcStatus, isPaused, isWordModalOpen]);

  // --- Core Functions ---
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
        contents: `Identify the primary language of this text. Return ONLY the language name (e.g., "English", "Spanish", "French"). \n\n${text.substring(0, 1000)}`,
      });
      const detected = response.text?.trim();
      if (detected) setSourceLanguage(detected);
    } catch (e) {
      console.error("Language detection failed", e);
      setSourceLanguage("Unknown");
    }
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
        setSourceCurrentPage(0);
        calculateMetrics(pages);
        setCurrentTrackingId(generateTrackingId());
        setCurrentLogId(`trans-${Date.now()}`);
        setEditedPages([]);
        setQcStatus('Draft');
        
        // Trigger auto-detection
        setSourceLanguage('Analyzing...');
        detectLanguage(pages[0] || '');
    } catch (err) {
        alert("Failed to ingest document.");
    }
  };

  const handleTranslate = async () => {
    if (sourcePages.length === 0) return;
    setIsLoading(true);
    setProgress(`Mirroring Clinical Structure...`);
    try {
        const structuralPrompt = `
            Task: Regulatory Document Mirroring.
            Dimension: ${dimension}${culturalNuances ? ' + Cultural Nuance' : ''}.
            STRUCTURAL RULES:
            1. Preserve paragraph density and breaks exactly.
            2. Match bullet-point hierarchies and symbols.
            3. Maintain identical sentence sequence.
            4. Target language: ${targetLanguage}.
        `;
        const result = await translateDocument(sourcePages, targetLanguage, structuralPrompt, setProgress);
        const pages = Array.isArray(result) ? result : [result];
        setEditedPages(pages);
        setOutputCurrentPage(0);
        setQcStatus('QC Pending');
    } catch (e) { 
        alert("Translation Pipeline Breach"); 
    } finally { 
        setIsLoading(false); 
        setProgress(''); 
    }
  };

  // --- Intervention Functions ---
  const handleWordClick = async (word: string, index: number) => {
    setSelectedWordData({ word, index });
    setIsWordModalOpen(true);
    setIsFetchingAlts(true);
    setAlternatives([]);
    setSelectedAlt('');
    setRationaleText('');
    try {
      const alts = await getAlternateSuggestions(word, editedPages[outputCurrentPage], targetLanguage);
      setAlternatives(alts);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingAlts(false);
    }
  };

  const confirmIntervention = () => {
    if (!selectedWordData || !selectedAlt) return;

    const newPages = [...editedPages];
    const words = newPages[outputCurrentPage].split(/\s+/);
    words[selectedWordData.index] = selectedAlt;
    newPages[outputCurrentPage] = words.join(' ');
    setEditedPages(newPages);

    const rationale: CorrectionRationale = {
      originalText: selectedWordData.word,
      updatedText: selectedAlt,
      rationale: rationaleText,
      timestamp: Date.now(),
      pageIndex: outputCurrentPage,
      wordIndex: selectedWordData.index,
      mqmSeverity,
      mqmType
    };

    try {
        const stored = localStorage.getItem('aide_translation_metrics');
        const logs: TranslationLog[] = stored ? JSON.parse(stored) : [];
        const logIndex = logs.findIndex(l => l.id === currentLogId);
        if (logIndex !== -1) {
            logs[logIndex].rationales = [...(logs[logIndex].rationales || []), rationale];
            localStorage.setItem('aide_translation_metrics', JSON.stringify(logs));
        }
    } catch (e) {
        console.error("Failed to update rationale in metrics", e);
    }

    setIsWordModalOpen(false);
    setSelectedWordData(null);
  };

  // --- Voice Sync Engine ---
  const handleToggleVoice = () => {
    if (isReading && !isPaused) {
        window.speechSynthesis.cancel();
        setIsPaused(true);
    } else {
        handleStartReading(lastCharIndex);
    }
  };

  const handleStartReading = (startIndex: number = 0) => {
    const fullText = editedPages[outputCurrentPage];
    if (!fullText) return;
    window.speechSynthesis.cancel();
    setTimeout(() => {
        const textToSpeak = fullText.substring(startIndex);
        if (!textToSpeak.trim()) return;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        const localeMap: Record<string, string> = { 
          'English': 'en-US', 'Spanish': 'es-ES', 'French': 'fr-FR', 'German': 'de-DE',
          'Chinese': 'zh-CN', 'Japanese': 'ja-JP', 'Tamil': 'ta-IN', 'Hindi': 'hi-IN',
          'Portuguese': 'pt-PT', 'Italian': 'it-IT', 'Russian': 'ru-RU', 'Korean': 'ko-KR',
          'Arabic': 'ar-SA', 'Thai': 'th-TH', 'Vietnamese': 'vi-VN', 'Turkish': 'tr-TR',
          'Polish': 'pl-PL', 'Dutch': 'nl-NL', 'Greek': 'el-GR', 'Czech': 'cs-CZ'
        };
        const targetLocale = localeMap[targetLanguage] || 'en-US';
        utterance.lang = targetLocale;

        const voices = window.speechSynthesis.getVoices();
        const langVoices = voices.filter(v => v.lang.startsWith(targetLocale.split('-')[0]));
        const femaleVoice = langVoices.find(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('samantha') || 
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('victoria') ||
          v.name.toLowerCase().includes('monica')
        );

        if (femaleVoice) utterance.voice = femaleVoice;
        else if (langVoices.length > 0) utterance.voice = langVoices[0];

        utterance.onboundary = (e) => {
            if (e.name === 'word') {
                const absolute = startIndex + e.charIndex;
                setLastCharIndex(absolute);
                const wordsSoFar = fullText.substring(0, absolute).trim().split(/\s+/).length;
                setHighlightedWordIndex(wordsSoFar);
            }
        };
        utterance.onstart = () => { setIsReading(true); setIsPaused(false); };
        utterance.onend = () => { if(!isPaused) { setIsReading(false); setLastCharIndex(0); setHighlightedWordIndex(null); } };
        window.speechSynthesis.speak(utterance);
    }, 50);
  };

  // --- Export Functions ---
  const handleDownloadWord = () => {
    if (editedPages.length === 0) return;
    const content = editedPages.join('<br/><br/>');
    const filename = `Translation_${projectNumber}_${targetLanguage}.doc`;
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; text-align: justify; padding: 1in; }
        .header-meta { font-family: Arial, sans-serif; font-size: 9pt; color: #666; margin-bottom: 20pt; text-align: right; border-bottom: 1px solid #ccc; }
        h1 { font-size: 16pt; color: #000; text-align: center; }
      </style></head>
      <body>
        <div class="header-meta">
          Project: ${projectNumber} | ID: ${currentTrackingId}<br/>
          Date: ${new Date().toLocaleDateString()}<br/>
          Type: ${documentType}
        </div>
        <h1>${documentType} - ${targetLanguage}</h1>
        <div>${content.replace(/\n/g, '<br/>')}</div>
      </body></html>
    `;
    const blob = new Blob([header], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setShowExportMenu(false);
  };

  const handleDownloadPdf = () => {
    if (editedPages.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const content = editedPages.join('<div style="page-break-after: always;"></div>');
    printWindow.document.write(`
      <html>
        <head>
          <title>${projectNumber} - Clinical Translation</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap');
            body { font-family: 'Lora', serif; line-height: 1.6; padding: 50px; color: #1e293b; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #0891b2; padding-bottom: 15px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
            .project-id { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
            .doc-title { font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 5px; }
            .content { white-space: pre-wrap; font-size: 14px; text-align: justify; }
            .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center; font-family: 'Inter', sans-serif; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="project-id">${projectNumber} | ${currentTrackingId}</div>
              <div class="doc-title">${documentType}</div>
            </div>
            <div class="project-id">Target: ${targetLanguage}</div>
          </div>
          <div class="content">${content}</div>
          <div class="footer">Generated via AIDE Agentic Platform - Confidential & Proprietary - ${new Date().toLocaleDateString()}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      setShowExportMenu(false);
    }, 500);
  };

  const handleDownloadCertificate = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>AIDE Agentic Certificate</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 100px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; }
            .header { text-align: center; border-bottom: 2px solid #0891b2; padding-bottom: 20px; margin-bottom: 50px; }
            .sys-name { font-size: 20px; font-weight: 800; color: #0891b2; text-transform: uppercase; letter-spacing: 1.5px; }
            .item { margin-bottom: 40px; border-left: 4px solid #f1f5f9; padding-left: 20px; }
            .label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
            .value { font-size: 16px; color: #0f172a; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header"><div class="sys-name">AIDE- Agentic Translation</div></div>
          <div class="item"><div class="label">Who Performed</div><div class="value">${qcReviewerName || 'Clinical AI Protocol'}</div></div>
          <div class="item"><div class="label">Date</div><div class="value">${dateStr}</div></div>
          <div class="item"><div class="label">Type of document</div><div class="value">${documentType}</div></div>
          <div class="item"><div class="label">Verification Completed</div><div class="value">Authenticated (Quality Accuracy Index: Certified)</div></div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const finalizeVerification = () => {
    if (!qcReviewerName.trim()) {
        alert("Authorized Name Required for GxP Finalization.");
        return;
    }
    setQcStatus('QC Finalized');
    setIsReviewMode(false);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
        {/* Full Header Configuration Bar */}
        <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-all ${(isSourceEnlarged || isOutputEnlarged) ? 'hidden' : 'block'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Project Identification</label>
                    <input value={projectNumber} onChange={e => setProjectNumber(e.target.value)} className="w-full border-slate-200 rounded-lg p-2.5 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-cyan-500/20" />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Document Class</label>
                    <select value={documentType} onChange={e => setDocumentType(e.target.value as TranslationDocType)} className="w-full border-slate-200 rounded-lg p-2.5 font-bold text-sm bg-slate-50 outline-none">
                        {Object.values(TranslationDocType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Optimization Dimension</label>
                    <select value={dimension} onChange={e => setDimension(e.target.value as TranslationDimension)} className="w-full border-slate-200 rounded-lg p-2.5 font-bold text-sm bg-slate-50 outline-none">
                        {Object.values(TranslationDimension).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contextual Nuances</label>
                    <button onClick={() => setCulturalNuances(!culturalNuances)} className={`w-full py-2.5 rounded-lg text-xs font-black uppercase transition-all shadow-sm border ${culturalNuances ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {culturalNuances ? 'ENABLED' : 'DISABLED'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Source Locale (Auto)</label>
                    <div className="w-full bg-slate-100 rounded-lg p-2.5 font-bold text-sm text-slate-600 border border-slate-200 min-h-[40px] flex items-center">{sourceLanguage}</div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Target Locale</label>
                    <select value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)} className="w-full border-slate-200 rounded-lg p-2.5 font-bold text-sm bg-slate-50 outline-none">
                        {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Traceability ID</label>
                    <div className="w-full bg-cyan-50 border border-cyan-100 rounded-lg p-2.5 font-mono text-cyan-600 font-black text-xs shadow-inner uppercase tracking-widest">{currentTrackingId || 'WAITING'}</div>
                </div>
                <div className="flex flex-col justify-end">
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-900 text-white rounded-lg p-2.5 font-black uppercase text-[10px] hover:bg-black transition-all shadow-md active:scale-95 border-b-2 border-slate-700">
                        {sourcePages.length > 0 ? 'Change Clinical Artifact' : 'Upload Document'}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileUpload} />
                </div>
            </div>

            <div className="flex justify-between items-center pt-5 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${initiateTranslation ? 'border-cyan-500 bg-cyan-50' : 'border-slate-300'}`}>
                        {initiateTranslation && <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse"></div>}
                    </div>
                    <input type="radio" checked={initiateTranslation} onChange={() => setInitiateTranslation(true)} className="hidden" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-cyan-600 transition-colors">Initiate Agentic Cycle</span>
                </label>
                
                <div className="grid grid-cols-3 gap-6 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Words</span><span className="text-xs font-bold text-slate-700">{wordCount.toLocaleString()}</span></div>
                    <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Tokens</span><span className="text-xs font-bold text-slate-700">{tokenCount.toLocaleString()}</span></div>
                    <div className="flex flex-col"><span className="text-[8px] font-black text-cyan-600 uppercase">Est. Price</span><span className="text-xs font-bold text-emerald-600">${estimatedCost.toFixed(4)}</span></div>
                </div>

                <div className="flex gap-3">
                    {isReviewMode && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-amber-700 uppercase tabular-nums">QC Mode Active: {Math.floor(qcSeconds/60)}m {qcSeconds%60}s</span>
                        </div>
                    )}
                    {qcStatus === 'QC Finalized' && (
                        <button onClick={handleDownloadCertificate} className="bg-amber-600 text-white px-5 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-amber-700 shadow-xl flex items-center gap-2">
                             <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                             Download GxP Certificate
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Dual-Channel Interface */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
            
            {/* 1. Clinical Source View */}
            <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full shadow-sm transition-all ${isOutputEnlarged ? 'hidden' : isSourceEnlarged ? 'lg:col-span-2' : 'flex'}`}>
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Source Artifact</span>
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200">
                            <button onClick={() => setSourceCurrentPage(Math.max(0, sourceCurrentPage - 1))} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg></button>
                            <span className="text-[10px] font-bold text-slate-600 font-mono">PG {sourceCurrentPage + 1}/{sourcePages.length || 1}</span>
                            <button onClick={() => setSourceCurrentPage(Math.min(sourcePages.length - 1, sourceCurrentPage + 1))} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
                        </div>
                    </div>
                    <button onClick={() => setIsSourceEnlarged(!isSourceEnlarged)} className="text-slate-400 hover:text-cyan-600 p-1.5 transition-colors">
                        {isSourceEnlarged ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 12l-6-6-6 6"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>}
                    </button>
                </div>
                <div className="flex-1 p-10 overflow-y-auto whitespace-pre-wrap text-[14px] leading-[2.6] text-slate-700 font-serif bg-slate-50/20">
                    {sourcePages[sourceCurrentPage] || "System Standby..."}
                </div>
            </div>

            {/* 2. Neural Translation Output */}
            <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full shadow-sm relative transition-all ${isSourceEnlarged ? 'hidden' : isOutputEnlarged ? 'lg:col-span-2' : 'flex'}`}>
                
                {/* Persistent Navigation Controls for Output */}
                <div className={`p-3 transition-colors duration-300 flex justify-between items-center sticky top-0 z-30 shadow-md ${isOutputEnlarged ? 'bg-slate-900 text-white' : 'bg-cyan-50/80 backdrop-blur border-b border-cyan-100'}`}>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full animate-pulse ${isOutputEnlarged ? 'bg-cyan-400' : 'bg-cyan-600'}`}></div>
                             <span className={`text-[10px] font-black uppercase tracking-widest ${isOutputEnlarged ? 'text-cyan-200' : 'text-cyan-800'}`}>Neural Review Engine</span>
                        </div>
                        
                        <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full border transition-colors ${isOutputEnlarged ? 'bg-white/10 border-white/10' : 'bg-white border-cyan-200'}`}>
                            <button onClick={() => setOutputCurrentPage(Math.max(0, outputCurrentPage - 1))} className={`hover:scale-110 transition-all ${isOutputEnlarged ? 'hover:text-cyan-400' : 'text-cyan-600'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg></button>
                            <span className={`text-[10px] font-black font-mono tracking-widest min-w-[60px] text-center ${isOutputEnlarged ? 'text-white' : 'text-cyan-900'}`}>PAGE {outputCurrentPage + 1}/{editedPages.length || 1}</span>
                            <button onClick={() => setOutputCurrentPage(Math.min(editedPages.length - 1, outputCurrentPage + 1))} className={`hover:scale-110 transition-all ${isOutputEnlarged ? 'hover:text-cyan-400' : 'text-cyan-600'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {editedPages.length > 0 && (
                            <>
                              <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors ${isOutputEnlarged ? 'bg-black/20 border-white/5' : 'bg-white border-cyan-100'}`}>
                                  <button onClick={handleToggleVoice} title="Read Aloud" className={`transition-colors ${isOutputEnlarged ? 'text-cyan-400 hover:text-white' : 'text-cyan-600 hover:text-cyan-800'}`}>
                                      {isReading && !isPaused ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path></svg> : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 001.555.832l3-2z" clipRule="evenodd"></path></svg>}
                                  </button>
                                  <button onClick={() => { window.speechSynthesis.cancel(); setLastCharIndex(0); setIsReading(false); setHighlightedWordIndex(null); }} title="Stop Reading" className="text-red-400 hover:text-red-600 transition-colors"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"></path></svg></button>
                              </div>

                              {/* New Export Menu */}
                              <div className="relative">
                                <button 
                                  onClick={() => setShowExportMenu(!showExportMenu)} 
                                  className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all ${isOutputEnlarged ? 'bg-white/10 text-white border-white/20' : 'bg-slate-900 text-white border-slate-900 shadow-md hover:bg-black'}`}
                                >
                                  EXPORT
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                </button>
                                {showExportMenu && (
                                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-2xl border border-slate-100 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button onClick={handleDownloadWord} className="w-full text-left px-4 py-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
                                      Microsoft Word
                                    </button>
                                    <button onClick={handleDownloadPdf} className="w-full text-left px-4 py-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
                                      Standard PDF
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                        )}
                        <button onClick={() => setIsReviewMode(!isReviewMode)} disabled={editedPages.length === 0} className={`px-4 py-1.5 text-[10px] font-black rounded-lg border transition-all ${isReviewMode ? 'bg-amber-500 text-slate-900 border-amber-500' : isOutputEnlarged ? 'bg-transparent text-white border-white/20 hover:border-white' : 'bg-white text-slate-500 border-slate-200'}`}>
                            {isReviewMode ? 'PAUSE QC' : 'LAUNCH HITL QC'}
                        </button>
                        <button onClick={() => setIsOutputEnlarged(!isOutputEnlarged)} className={`p-1 transition-colors ${isOutputEnlarged ? 'text-white hover:text-cyan-400' : 'text-slate-400 hover:text-cyan-600'}`}>
                            {isOutputEnlarged ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 12l-6-6-6 6"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>}
                        </button>
                    </div>
                </div>
                
                {/* Document Mirroring Viewport */}
                <div className="flex-1 p-12 overflow-y-auto bg-white font-serif relative">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-cyan-600 gap-6">
                            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">{progress}</span>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap leading-[2.8] text-[15px] text-slate-900">
                            {editedPages[outputCurrentPage]?.split(/\s+/).map((word, i) => (
                                <span key={i} onClick={() => isReviewMode && handleWordClick(word, i)} className={`inline-block px-1 rounded transition-all duration-150 ${highlightedWordIndex === i ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(5,150,105,0.7)] scale-110 z-10' : isReviewMode ? 'hover:bg-cyan-100 border-b border-transparent hover:border-cyan-400 cursor-pointer' : ''}`}>
                                    {word}{' '}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {isReviewMode && qcStatus !== 'QC Finalized' && (
                    <div className="p-4 bg-slate-950 flex justify-between items-center text-white border-t border-white/5 shadow-2xl sticky bottom-0 z-40">
                        <div className="flex flex-col flex-1 max-w-xs">
                            <label className="text-[8px] font-black text-slate-500 uppercase mb-1">Performing QC Reviewer (Digital Audit Signature)</label>
                            <input type="text" value={qcReviewerName} onChange={e => setQcReviewerName(e.target.value)} placeholder="Authorized Name..." className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-[11px] font-bold outline-none focus:border-cyan-500 transition-all text-white" />
                        </div>
                        <button onClick={finalizeVerification} className="bg-emerald-600 px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] shadow-lg hover:bg-emerald-700 active:scale-95 transition-all">Sign & Authorize</button>
                    </div>
                )}
            </div>
        </div>

        {/* Semantic Correction Window */}
        {isWordModalOpen && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Semantic Intervention Window</h3>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase">Target Artifact Token: <span className="font-bold text-red-500 underline decoration-2">{selectedWordData?.word}</span></p>
                        </div>
                        <button onClick={() => { setIsWordModalOpen(false); }} className="text-slate-400 hover:text-slate-600 p-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                    </div>
                    <div className="p-7 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intelligent Equivalents</label>
                            {isFetchingAlts ? <div className="flex gap-3 animate-pulse">{[1,2,3,4].map(i => <div key={i} className="h-11 w-28 bg-slate-100 rounded-xl" />)}</div> : (
                                <div className="flex flex-wrap gap-3">{alternatives.map((alt, i) => (<button key={i} onClick={() => setSelectedAlt(alt)} className={`px-5 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${selectedAlt === alt ? 'bg-cyan-600 text-white border-cyan-600 shadow-lg' : 'bg-white text-slate-600 border-slate-100 hover:border-cyan-300'}`}>{alt}</button>))}</div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block">MQM Error Severity</label><select value={mqmSeverity} onChange={e => setMqmSeverity(e.target.value as MQMSeverity)} className="w-full border-slate-200 rounded-xl text-xs h-11 px-3 font-bold bg-slate-50 outline-none">{Object.values(MQMSeverity).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block">MQM Taxonomy Class</label><select value={mqmType} onChange={e => setMqmType(e.target.value as MQMType)} className="w-full border-slate-200 rounded-xl text-xs h-11 px-3 font-bold bg-slate-50 outline-none">{Object.values(MQMType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        </div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block">Technical Remediation Rationale</label><textarea value={rationaleText} onChange={e => setRationaleText(e.target.value)} className="w-full border-slate-200 rounded-2xl p-4 text-xs h-28 outline-none bg-slate-50 font-medium transition-all" placeholder="Required for digital audit trail..." /></div>
                        <button onClick={confirmIntervention} disabled={!selectedAlt || !rationaleText} className="w-full bg-slate-900 text-white py-4.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black disabled:opacity-30 transition-all shadow-xl active:scale-95">Commit Neural Correction</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TranslationTool;
