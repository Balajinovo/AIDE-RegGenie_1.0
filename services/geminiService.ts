
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, RegulationEntry, NewsItem, TMFDocument, GapAnalysisResult, MonitoringReportLog } from '../types';

// --- Helper to extract JSON from text ---
const extractJson = (text: string): any => {
  if (!text) return null;
  let cleanText = text.trim();
  cleanText = cleanText.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '');
  
  const firstBracket = cleanText.indexOf('[');
  const lastBracket = cleanText.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const arrayCandidate = cleanText.substring(firstBracket, lastBracket + 1);
      try { return JSON.parse(arrayCandidate); } catch (e) {}
  }
  
  const firstCurly = cleanText.indexOf('{');
  const lastCurly = cleanText.lastIndexOf('}');
  if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
      const objectCandidate = cleanText.substring(firstCurly, lastCurly + 1);
      try { return JSON.parse(objectCandidate); } catch (e) {}
  }

  try { return JSON.parse(cleanText); } catch (e) {
    return null;
  }
};

// --- Audio Utilities ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Fetches alternative word suggestions for QC intervention.
 */
export const getAlternateSuggestions = async (word: string, context: string, targetLanguage: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `In the context of this clinical text: "${context}", what are 4 professional alternatives for the word "${word}" in ${targetLanguage}? Focus on clinical and regulatory accuracy. Return a JSON array of strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return extractJson(response.text) || [];
};

/**
 * Translates clinical documents between languages.
 */
export const translateDocument = async (content: string | string[], targetLanguage: string, mode: string = 'General', onProgress?: (msg: string) => void): Promise<string | string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isArray = Array.isArray(content);
  const input = isArray ? content : [content];
  const results: string[] = [];

  for (let i = 0; i < input.length; i++) {
    if (onProgress) onProgress(`Translating segment ${i + 1} of ${input.length}...`);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate the following clinical text to ${targetLanguage} with ${mode} focus. Preserve terminology accuracy. \n\n${input[i]}`,
    });
    results.push(response.text || '');
  }
  return isArray ? results : results[0];
};

export const getRegulatoryNews = async (): Promise<NewsItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: 'Find critical regulatory updates from FDA, EMA, MHRA in the last 7 days.',
    config: { tools: [{ googleSearch: {} }] }
  });
  return extractJson(response.text) || [];
};

// Fix: Added missing export
export const getArchivedRegulatoryNews = async (): Promise<NewsItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: 'Find historical regulatory updates from FDA, EMA, MHRA in the last 6 months.',
    config: { tools: [{ googleSearch: {} }] }
  });
  return extractJson(response.text) || [];
};

export const analyzeRegulation = async (item: RegulationEntry): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze: ${item.title}\n${item.content}`,
    config: { responseMimeType: "application/json" }
  });
  return extractJson(response.text);
};

// Fix: Added missing export
export const syncIntelligence = async (existingTitles: string[]): Promise<RegulationEntry[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Identify new pharmaceutical or clinical research regulations from primary agencies (FDA, EMA, PMDA) that are not in this existing collection: ${existingTitles.join(', ')}. Return as a JSON array of RegulationEntry objects.`,
    config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
  });
  return extractJson(response.text) || [];
};

// Fix: Added missing export
export const categorizeNewEntry = async (text: string): Promise<Partial<RegulationEntry>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Given the following regulatory text, extract the title, agency, region, country, date, category, summary, impact level, and status. Return as JSON.\n\nText: ${text}`,
    config: { responseMimeType: "application/json" }
  });
  return extractJson(response.text) || {};
};

export const streamChatResponse = async (history: any[], message: string, onChunk: (chunk: string, metadata?: any) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    history: history,
    config: { tools: [{ googleSearch: {} }] }
  });
  const stream = await chat.sendMessageStream({ message });
  for await (const chunk of stream) {
    onChunk(chunk.text || '', chunk.candidates?.[0]?.groundingMetadata);
  }
};

// Fix: Added missing export for OpenAI fallback mechanism
export const streamOpenAIResponse = async (history: any[], message: string, apiKey: string, onChunk: (chunk: string) => void) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })).concat({ role: 'user', content: message }),
      stream: true
    })
  });

  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const content = json.choices[0].delta.content;
          if (content) onChunk(content);
        } catch (e) {}
      }
    }
  }
};

export const getTMFChecklist = async (country: string): Promise<TMFDocument[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `TMF checklist for ${country}`,
    config: { responseMimeType: "application/json" }
  });
  return extractJson(response.text) || [];
};

export const synthesizeMonitoringReport = async (visitType: string, notes: string, templateInfo: string, metadata: any): Promise<Partial<MonitoringReportLog>> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Synthesize ${visitType} report from notes: ${notes}`,
        config: { responseMimeType: "application/json" }
    });
    return extractJson(response.text);
};

export const generateGapAnalysis = async (sop: string, reg: string): Promise<GapAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Gap analysis between SOP and Reg: ${sop} vs ${reg}`,
    config: { responseMimeType: "application/json" }
  });
  return extractJson(response.text);
};

// Fix: Added missing export
export const generateICF = async (protocol: any, template: any, reg: any, country: string, type: string, lang: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate a clinical informed consent form (${type}) for ${country} in ${lang}.
        Inputs:
        Protocol Content: ${protocol.text || 'Document provided'}
        Template Content: ${template.text || 'Document provided'}
        Specific Regulations: ${reg.text || 'Standard GxP regulations'}`,
        config: { thinkingConfig: { thinkingBudget: 4000 } }
    });
    return response.text || '';
};

export const analyzeDoseEscalation = async (studyData: any): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Dose escalation analysis: ${JSON.stringify(studyData)}`,
    config: { responseMimeType: "application/json" }
  });
  return extractJson(response.text);
};
