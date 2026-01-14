
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TranslationTool from './components/TranslationTool';
import TranslationMetrics from './components/TranslationMetrics';
import MonitoringReportGenerator from './components/MonitoringReportGenerator';
import ChatAssistant from './components/ChatAssistant';
import Phase1DoseManagement from './components/Phase1DoseManagement';
import AgenticMonitoring from './components/AgenticMonitoring';
import CompetencyDashboard from './components/CompetencyDashboard';
import { RegulationEntry, DatabaseFilters, AppTab, TranslationLog } from './types';
import { getAllRegulations, saveRegulation, updateRegulationInDb } from './services/dbService';

const LoginScreen = ({ onLogin }: { onLogin: (isOwner: boolean) => void }) => {
  const [activeTab, setActiveTab] = useState<'guest' | 'admin'>('guest');
  const [accessCode, setAccessCode] = useState('');
  const [confirmCode, setConfirmCode] = useState(''); 
  const [error, setError] = useState('');
  
  const getInitialRegistrationState = () => {
      try {
          return !!localStorage.getItem('aide_admin_code');
      } catch (e) {
          return false;
      }
  };
  const [isRegistered, setIsRegistered] = useState(getInitialRegistrationState);

  const handleAdminLogin = () => {
     const storedCode = localStorage.getItem('aide_admin_code');
     if (storedCode && accessCode.trim() === storedCode) {
         onLogin(true);
     } 
     else if (!storedCode && accessCode.trim() === 'admin') {
         localStorage.setItem('aide_admin_code', 'admin');
         onLogin(true);
     }
     else {
         setError('Invalid Access Code');
     }
  };

  const handleRegistration = () => {
     if (accessCode.trim().length < 4) {
         setError('Code must be at least 4 characters');
         return;
     }
     if (accessCode !== confirmCode) {
         setError('Codes do not match');
         return;
     }
     localStorage.setItem('aide_admin_code', accessCode.trim());
     setIsRegistered(true);
     onLogin(true);
  };

  const handleGuestAccess = () => {
      onLogin(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
         <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-cyan-600 blur-3xl filter"></div>
         <div className="absolute top-40 right-20 w-72 h-72 rounded-full bg-teal-600 blur-3xl filter"></div>
      </div>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col">
        <div className="p-8 pb-6 text-center border-b border-slate-100 bg-slate-50/50">
           <div className="flex justify-center mb-4">
             <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg flex-shrink-0 transition-transform hover:scale-105">
               <svg viewBox="0 0 512 512" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="logo-grad-login" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#2dd4bf" />
                      <stop offset="1" stopColor="#0891b2" />
                    </linearGradient>
                  </defs>
                  <rect width="512" height="512" rx="0" fill="url(#logo-grad-login)" />
                  <path d="M160 416h192c17.67 0 32-14.33 32-32s-6.5-24.6-16.8-36.5L288 256V128h32V96H192v32h32v128L144.8 347.5C134.5 359.4 128 366.3 128 384s14.33 32 32 32z" fill="white" stroke="white" strokeWidth="20" strokeLinejoin="round"/>
               </svg>
             </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">AIDE - Clinical Development</h2>
          <p className="text-slate-500 text-sm">Intelligence & Research Platform</p>
        </div>
        <div className="flex border-b border-slate-200">
            <button onClick={() => setActiveTab('guest')} className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'guest' ? 'bg-white text-cyan-600 border-b-2 border-cyan-600' : 'bg-slate-50 text-slate-400'}`}>Guest Access</button>
            <button onClick={() => setActiveTab('admin')} className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'admin' ? 'bg-white text-slate-800 border-b-2 border-slate-800' : 'bg-slate-50 text-slate-400'}`}>Admin Panel</button>
        </div>
        <div className="p-8 bg-white flex-1">
            {activeTab === 'guest' ? (
                <div className="flex flex-col items-center">
                    <p className="text-slate-600 text-center mb-8 leading-relaxed">Access the clinical research dashboard, latest updates, and compliance tools.</p>
                    <button onClick={handleGuestAccess} className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-3">Enter Public Portal</button>
                </div>
            ) : (
                <div className="flex flex-col">
                    {!isRegistered ? (
                        <>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Create Access Code</label>
                                <input type="password" placeholder="Enter new code" className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none text-sm bg-slate-50" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />
                            </div>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Confirm Access Code</label>
                                <input type="password" placeholder="Re-enter code" className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none text-sm bg-slate-50" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
                            </div>
                            <button onClick={handleRegistration} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg">Register & Login</button>
                        </>
                    ) : (
                        <>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Access Code</label>
                                <input type="password" placeholder="Enter Admin Code" className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none text-sm bg-slate-50" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />
                            </div>
                            <button onClick={handleAdminLogin} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg">Login to Admin Panel</button>
                        </>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, currentOpenAIKey, onSave }: any) => {
  const [key, setKey] = useState(currentOpenAIKey);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-lg">System Configuration</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-6">
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">OpenAI API Key (Optional)</label>
              <input type="password" style={{ fontFamily: 'monospace' }} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" placeholder="sk-..." value={key} onChange={(e) => setKey(e.target.value)} />
           </div>
           <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-lg">Cancel</button>
              <button onClick={() => onSave(key)} className="flex-1 px-4 py-2.5 bg-slate-900 text-white font-medium rounded-lg">Save & Reload</button>
           </div>
        </div>
      </div>
    </div>
  );
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('chat');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userOpenAIKey, setUserOpenAIKey] = useState('');
  
  // Shared state for navigation
  const [translationSharedContent, setTranslationSharedContent] = useState<string | undefined>(undefined);

  // Expose setActiveTab to global scope for internal navigation
  useEffect(() => {
    (window as any).setActiveTab = (tab: AppTab) => setActiveTab(tab);
  }, []);

  useEffect(() => {
    const loadData = async () => {
        setIsLoadingData(true);
        // Only loading to satisfy the data existence check in UI
        await getAllRegulations();
        setIsLoadingData(false);
    };
    loadData();
  }, []);

  const handleResumeTranslationTask = (log: TranslationLog) => {
      setTranslationSharedContent(undefined); 
      setActiveTab('translation');
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={(owner) => { setIsOwner(owner); setIsLoggedIn(true); }} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onOpenSettings={() => setIsSettingsOpen(true)} isOwner={isOwner} />
      <main className="flex-1 ml-64 p-8 h-screen overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          <header className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                {activeTab === 'chat' && 'GxP Genie'}
                {activeTab === 'competency-dashboard' && 'GxP Genie Intelligence'}
                {activeTab === 'translation' && 'Intelligence Translator'}
                {activeTab === 'translation-metrics' && 'Translation Workflow Dashboard'}
                {activeTab === 'monitoring-report' && 'Agentic Monitoring Report Generator'}
                {activeTab === 'dose-management' && 'Phase-1 Dose Escalation'}
                {activeTab === 'agentic-monitoring' && 'Agentic Surveillance NOC'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                AIDE - Advanced Intelligence Data Engine for Clinical Development
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center font-bold text-slate-500">
                {isOwner ? 'AD' : 'US'}
            </div>
          </header>

          <div className="flex-1 min-h-0">
            {isLoadingData ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-bold text-xs uppercase tracking-widest animate-pulse">Syncing Database...</span>
                    </div>
                </div>
            ) : (
                <>
                    {activeTab === 'chat' && <ChatAssistant openaiKey={userOpenAIKey} />}
                    {activeTab === 'competency-dashboard' && <CompetencyDashboard />}
                    {activeTab === 'translation' && (
                        <TranslationTool initialText={translationSharedContent} />
                    )}
                    {activeTab === 'translation-metrics' && (
                        <TranslationMetrics onAction={handleResumeTranslationTask} />
                    )}
                    {activeTab === 'monitoring-report' && <MonitoringReportGenerator />}
                    {activeTab === 'dose-management' && <Phase1DoseManagement />}
                    {activeTab === 'agentic-monitoring' && <AgenticMonitoring />}
                </>
            )}
          </div>
        </div>
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentOpenAIKey={userOpenAIKey} onSave={(key: string) => { setUserOpenAIKey(key); setIsSettingsOpen(false); }} />
    </div>
  );
};

export default App;
