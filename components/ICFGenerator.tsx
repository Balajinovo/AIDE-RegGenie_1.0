
import React, { useState, useRef } from 'react';
import { ALL_COUNTRIES } from '../constants';
import { generateICF, translateDocument } from '../services/geminiService';
import { extractRawText } from 'mammoth';

const ICFGenerator: React.FC = () => {
  const [protocolContent, setProtocolContent] = useState('');
  const [protocolFile, setProtocolFile] = useState<{data: string, mimeType: string, name: string} | null>(null);

  const [templateContent, setTemplateContent] = useState('');
  const [templateFile, setTemplateFile] = useState<{data: string, mimeType: string, name: string} | null>(null);

  const [regContent, setRegContent] = useState('');
  const [regFile, setRegFile] = useState<{data: string, mimeType: string, name: string} | null>(null);

  const [selectedCountry, setSelectedCountry] = useState('Global');
  
  const [icfType, setIcfType] = useState('Master ICF');
  const [targetLanguage, setTargetLanguage] = useState('English');

  const [generatedICF, setGeneratedICF] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true); 
  
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationTarget, setTranslationTarget] = useState('Spanish');

  const protocolFileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const regFileInputRef = useRef<HTMLInputElement>(null);
  
  const ICF_TYPES = [
      'Master ICF', 
      'Pregnancy Partner ICF', 
      'Genomic ICF', 
      'Assent Form'
  ];

  const LANGUAGES = [
      'English', 'French', 'German', 'Spanish', 'Chinese', 'Korean', 'Thai', 'Tamil'
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setContent: (text: string) => void, type: 'protocol' | 'template' | 'reg') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
         const reader = new FileReader();
         reader.onload = async (event) => {
             const arrayBuffer = event.target?.result as ArrayBuffer;
             try {
                 const result = await extractRawText({ arrayBuffer });
                 setContent(result.value);
                 if (type === 'protocol') setProtocolFile(null);
                 else if (type === 'template') setTemplateFile(null);
                 else if (type === 'reg') setRegFile(null);
             } catch (err) {
                 console.error("Error extracting Word text", err);
                 alert("Failed to read Word document.");
             }
         };
         reader.readAsArrayBuffer(file);
         return;
    }

    if (file.type === 'application/pdf') {
         const reader = new FileReader();
         reader.onload = (event) => {
             const result = event.target?.result as string;
             const base64 = result.split(',')[1];
             const fileData = {
                 data: base64,
                 mimeType: file.type,
                 name: file.name
             };

             if (type === 'protocol') setProtocolFile(fileData);
             else if (type === 'template') setTemplateFile(fileData);
             else if (type === 'reg') setRegFile(fileData);

             setContent(''); 
         };
         reader.readAsDataURL(file);
         return;
    }

    if (file.type === "text/plain" || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setContent(event.target.result as string);
                
                if (type === 'protocol') setProtocolFile(null);
                else if (type === 'template') setTemplateFile(null);
                else if (type === 'reg') setRegFile(null);
            }
        };
        reader.readAsText(file);
    } else {
        alert("Supported formats: .txt, .md, .pdf, .docx");
    }
  };

  const clearSection = (type: 'protocol' | 'template' | 'reg') => {
    if (type === 'protocol') {
        setProtocolContent('');
        setProtocolFile(null);
        if (protocolFileInputRef.current) protocolFileInputRef.current.value = '';
    } else if (type === 'template') {
        setTemplateContent('');
        setTemplateFile(null);
        if (templateFileInputRef.current) templateFileInputRef.current.value = '';
    } else if (type === 'reg') {
        setRegContent('');
        setRegFile(null);
        if (regFileInputRef.current) regFileInputRef.current.value = '';
    }
  };

  const handleResetAll = () => {
      clearSection('protocol');
      clearSection('template');
      clearSection('reg');
      setGeneratedICF('');
      setIsEditMode(true);
  };

  const handleGenerate = async () => {
    if (!protocolContent.trim() && !protocolFile) {
        alert("Please provide the Protocol content.");
        return;
    }

    setIsLoading(true);
    try {
        const protocolInput = {
            text: protocolContent,
            fileData: protocolFile?.data,
            mimeType: protocolFile?.mimeType
        };

        const templateInput = {
            text: templateContent,
            fileData: templateFile?.data,
            mimeType: templateFile?.mimeType
        };

        const regInput = {
            text: regContent,
            fileData: regFile?.data,
            mimeType: regFile?.mimeType
        };

        const result = await generateICF(protocolInput, templateInput, regInput, selectedCountry, icfType, targetLanguage);
        setGeneratedICF(result);
        setIsEditMode(false);
    } catch (error) {
        alert("Failed to generate ICF.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
      if(!generatedICF) return;
      setIsTranslating(true);
      try {
          const translatedText = await translateDocument(generatedICF, translationTarget);
          // Fix: Ensure setGeneratedICF receives a string. translateDocument can return string | string[].
          const finalResult = Array.isArray(translatedText) ? translatedText.join('') : translatedText;
          setGeneratedICF(finalResult);
          if (LANGUAGES.includes(translationTarget)) {
              setTargetLanguage(translationTarget);
          }
      } catch (error) {
          alert("Translation failed.");
      } finally {
          setIsTranslating(false);
      }
  };

  const handleDownload = () => {
    if (!generatedICF) return;

    const element = document.createElement("a");
    const mimeType = "application/msword";
    const filename = `${icfType.replace(/\s+/g, '_')}_${selectedCountry.replace(/\s+/g, '_')}_${targetLanguage}.doc`;
    
    const styles = `
      <style>
        @page { size: A4; margin: 2.54cm; }
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; text-align: justify; }
        h1 { font-family: 'Arial', sans-serif; font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 12pt; }
        h2 { font-family: 'Arial', sans-serif; font-size: 14pt; font-weight: bold; border-bottom: 1px solid #000; margin-top: 18pt; margin-bottom: 12pt; }
        .meta-info { font-family: 'Courier New', monospace; font-size: 9pt; text-align: right; margin-bottom: 24pt; color: #666; }
        .footer { font-size: 8pt; text-align: center; margin-top: 24pt; border-top: 1px solid #ccc; padding-top: 6pt; color: #888; }
      </style>
    `;

    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${filename}</title>${styles}</head>
      <body>
        <h1>${icfType}</h1>
        <div class="meta-info">
            Jurisdiction: ${selectedCountry} <br/>
            Language: ${targetLanguage} <br/>
            Generated: ${new Date().toLocaleDateString()}
        </div>
        <div class="content">${generatedICF}</div>
        <div class="footer">Generated by AIDE - Clinical Development System - Confidential</div>
      </body>
      </html>
    `;

    const file = new Blob([content], {type: mimeType});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col flex-1 space-y-6 min-h-0">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Master ICF & Assent Generator</h2>
                    <p className="text-sm text-slate-500">
                        AI-powered generation of clinical research forms with global compliance.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button onClick={handleResetAll} disabled={isLoading} className="px-4 py-3 bg-white text-slate-600 font-bold rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm disabled:opacity-50">Reset</button>
                    <button onClick={handleGenerate} disabled={isLoading || (!protocolContent && !protocolFile)} className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-bold rounded-lg hover:from-cyan-700 hover:to-teal-700 shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                        {isLoading ? 'Generating...' : 'Generate Document'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jurisdiction</label>
                    <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} className="w-full border-slate-300 rounded-lg text-sm font-semibold">
                        <option value="Global">Global (Generic)</option>
                        {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Document Type</label>
                    <select value={icfType} onChange={(e) => setIcfType(e.target.value)} className="w-full border-slate-300 rounded-lg text-sm font-semibold">
                        {ICF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Language</label>
                    <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full border-slate-300 rounded-lg text-sm font-semibold">
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
            <div className={`flex-1 flex flex-col gap-4 ${!isEditMode ? 'hidden lg:flex lg:w-1/3 lg:flex-none' : ''}`}>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[200px]">
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">Protocol</h3>
                        <button onClick={() => protocolFileInputRef.current?.click()} className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors uppercase">Upload File</button>
                        <input type="file" ref={protocolFileInputRef} className="hidden" accept=".txt,.md,.pdf,.docx" onChange={(e) => handleFileUpload(e, setProtocolContent, 'protocol')} />
                    </div>
                    <div className="flex-1 p-3">
                        <textarea className="w-full h-full resize-none border-0 focus:ring-0 text-xs text-slate-600 font-mono bg-transparent" placeholder="Paste protocol or upload..." value={protocolContent} onChange={(e) => setProtocolContent(e.target.value)}></textarea>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[180px]">
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">Template</h3>
                        <button onClick={() => templateFileInputRef.current?.click()} className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors uppercase">Upload File</button>
                        <input type="file" ref={templateFileInputRef} className="hidden" accept=".txt,.md,.pdf,.docx" onChange={(e) => handleFileUpload(e, setTemplateContent, 'template')} />
                    </div>
                    <div className="flex-1 p-3">
                        <textarea className="w-full h-full resize-none border-0 focus:ring-0 text-xs text-slate-600 font-mono bg-transparent" placeholder="Paste template or upload..." value={templateContent} onChange={(e) => setTemplateContent(e.target.value)}></textarea>
                    </div>
                </div>
            </div>

            <div className={`flex-[2] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden ${isEditMode ? 'hidden lg:flex' : ''}`}>
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex justify-between items-center z-10">
                     <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-700 text-sm">Document View</h3>
                          {!isEditMode && <button onClick={() => setIsEditMode(true)} className="lg:hidden text-xs font-bold text-cyan-600 hover:underline">Edit</button>}
                     </div>
                     {generatedICF && (
                          <div className="flex items-center gap-2">
                              <select value={translationTarget} onChange={(e) => setTranslationTarget(e.target.value)} className="text-xs border-slate-200 rounded-md h-8">
                                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>
                              <button onClick={handleTranslate} disabled={isTranslating} className="text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-md">{isTranslating ? '...' : 'Translate'}</button>
                              <button onClick={handleDownload} className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100 hover:bg-blue-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>
                          </div>
                     )}
                </div>
                <div className="flex-1 overflow-y-auto p-8 bg-slate-200/50">
                      {generatedICF ? (
                          <div className="bg-white shadow-xl max-w-[21cm] min-h-[29.7cm] mx-auto p-12 prose prose-sm max-w-none">
                              <div dangerouslySetInnerHTML={{ __html: generatedICF }} />
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400">
                              <p className="font-medium text-slate-500">Output will be displayed here</p>
                          </div>
                      )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ICFGenerator;
