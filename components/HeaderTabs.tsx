import React from 'react';
import { SubTab } from '../types';

interface HeaderTabsProps {
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
}

const TABS: { id: SubTab; label: string }[] = [
  { id: 'gemini', label: 'Gemini API' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'copilot', label: 'Co-pilot API' },
];

const HeaderTabs: React.FC<HeaderTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="border-b border-slate-200 mb-6">
      <nav className="-mb-px flex space-x-6" aria-label="Tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none ${
              activeTab === tab.id
                ? 'border-cyan-600 text-cyan-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default HeaderTabs;
