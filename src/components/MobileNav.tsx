'use client';

import React from 'react';
import { List, BarChart2, Layers, Briefcase, Clock, User } from 'lucide-react';

export type MobileTab = 'WATCHLIST' | 'CHART' | 'OPTIONS' | 'POSITIONS' | 'ORDERS' | 'ACCOUNT';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  openPositionsCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  openPositionsCount,
}) => {
  const tabs: { id: MobileTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'WATCHLIST', label: 'Watchlist', icon: <List className="w-4 h-4" /> },
    { id: 'CHART', label: 'Chart', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'OPTIONS', label: 'Options', icon: <Layers className="w-4 h-4" /> },
    { id: 'POSITIONS', label: 'Positions', icon: <Briefcase className="w-4 h-4" />, badge: openPositionsCount },
    { id: 'ORDERS', label: 'Orders', icon: <Clock className="w-4 h-4" /> },
    { id: 'ACCOUNT', label: 'Account', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0E121A]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#1E2430] pb-[env(safe-area-inset-bottom)] transition-colors">
      <div className="grid grid-cols-6 h-14">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center relative transition-colors ${
                isActive ? 'text-[#00D09C]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#00D09C] text-black font-extrabold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold mt-0.5">{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-[#00D09C] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
