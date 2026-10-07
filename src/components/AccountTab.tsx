'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { PortfolioSummary } from '@/types/trading';
import { 
  User, 
  KeyRound, 
  LogOut, 
  UserPlus, 
  Check, 
  Trash2, 
  ShieldCheck, 
  Lock,
  Wallet,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface AccountTabProps {
  portfolio: PortfolioSummary;
  onResetAccount: () => void;
  onNavigateToWatchlist?: () => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({
  portfolio,
  onResetAccount,
  onNavigateToWatchlist,
}) => {
  const { currentUser, usersList, register, login, logout, deleteAccount, isUsernameAvailable } = useAuth();

  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('SIGNUP');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Check unique availability dynamically while typing in SIGNUP mode
  useEffect(() => {
    if (authMode !== 'SIGNUP' || !usernameInput.trim()) {
      setIsAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      if (usernameInput.trim().length >= 3) {
        const avail = await isUsernameAvailable(usernameInput.trim());
        setIsAvailable(avail);
      } else {
        setIsAvailable(null);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [usernameInput, authMode, isUsernameAvailable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (authMode === 'SIGNUP') {
      const res = await register(usernameInput, passwordInput);
      if (res.success) {
        setSuccessMessage(`Account created successfully! Welcome ${usernameInput}`);
        setUsernameInput('');
        setPasswordInput('');
      } else {
        setErrorMessage(res.message || 'Failed to create account');
      }
    } else {
      const res = await login(usernameInput, passwordInput);
      if (res.success) {
        setSuccessMessage('Logged in successfully!');
        setUsernameInput('');
        setPasswordInput('');
      } else {
        setErrorMessage(res.message || 'Failed to login');
      }
    }
  };

  // If user is already logged in, show their full Account Management & Profile page
  if (currentUser) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0B0E14] p-4 sm:p-6 transition-colors pb-24 md:pb-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Active User Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#121622] border border-slate-200 dark:border-[#1E2638] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${currentUser.avatarColor} text-white font-extrabold flex items-center justify-center text-xl shadow-md uppercase`}>
                  {currentUser.username.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      {currentUser.username}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-[#00D09C] border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Isolated trading terminal & portfolio data
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (window.confirm(`Log out of account '${currentUser.username}'?`)) {
                    logout();
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>

            {/* Quick Balance & P&L Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-[#1A202E]">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161C28] border border-slate-200/80 dark:border-[#222A3A]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Available Margin</span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  ₹{portfolio.availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161C28] border border-slate-200/80 dark:border-[#222A3A]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total P&L Today</span>
                <span className={`text-sm sm:text-base font-mono font-bold tabular-nums ${
                  portfolio.totalUnrealizedPnL >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'
                }`}>
                  {portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}₹{portfolio.totalUnrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161C28] border border-slate-200/80 dark:border-[#222A3A] col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Account Net Value</span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  ₹{portfolio.totalAccountValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (window.confirm('Reset this account balance to ₹10,00,000 and clear all positions?')) {
                    onResetAccount();
                  }
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold underline underline-offset-4"
              >
                Reset Demo Balance to ₹10 Lakhs
              </button>

              {onNavigateToWatchlist && (
                <button
                  onClick={onNavigateToWatchlist}
                  className="px-4 py-2 bg-[#00D09C] hover:bg-[#00B887] text-black font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  <span>Go to Watchlist & Trade</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Switch Account or Manage Other Profiles */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#121622] border border-slate-200 dark:border-[#1E2638] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                All Registered Users on this Device ({usersList.length})
              </h3>
              <button
                onClick={() => {
                  logout();
                  setAuthMode('SIGNUP');
                }}
                className="text-xs font-bold text-[#00D09C] hover:underline flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Create Another User</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-[#19202E]">
              {usersList.map((uname) => {
                const isCur = currentUser?.username.toLowerCase() === uname.toLowerCase();
                return (
                  <div key={uname} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#182030] text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs uppercase">
                        {uname.substring(0, 2)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{uname}</span>
                        {isCur && <span className="ml-2 text-[10px] text-emerald-500 font-semibold">• Currently active</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCur && (
                        <button
                          onClick={() => {
                            logout();
                            setUsernameInput(uname);
                            setAuthMode('LOGIN');
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-[#00D09C]/15 hover:bg-[#00D09C] text-[#00D09C] hover:text-black transition-colors"
                        >
                          Switch
                        </button>
                      )}

                      {usersList.length > 1 && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete user account '${uname}' and remove their trades?`)) {
                              deleteAccount(uname);
                            }
                          }}
                          title="Delete profile"
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user is NOT logged in, show mandatory Account Creation / Login Gate
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-[#0B0E14] transition-colors pb-24 md:pb-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-[#121622] rounded-3xl border border-slate-200 dark:border-[#20283A] shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00D09C] to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto text-black font-extrabold">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Account Required to Trade
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Create a unique User ID and password to get your private ₹10,00,000 demo trading account.
          </p>
        </div>

        {/* Sub-tabs: CREATE USER ID vs LOGIN */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#161C28] rounded-xl border border-slate-200 dark:border-[#20283A] text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setAuthMode('SIGNUP'); setErrorMessage(''); setSuccessMessage(''); }}
            className={`py-2 rounded-lg transition-all ${
              authMode === 'SIGNUP'
                ? 'bg-white dark:bg-[#222B3D] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Create User ID
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('LOGIN'); setErrorMessage(''); setSuccessMessage(''); }}
            className={`py-2 rounded-lg transition-all ${
              authMode === 'LOGIN'
                ? 'bg-white dark:bg-[#222B3D] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Login Existing
          </button>
        </div>

        {/* Feedback messages */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Account Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Unique User ID *
              </label>
              {authMode === 'SIGNUP' && isAvailable !== null && (
                <span className={`text-[10px] font-bold ${isAvailable ? 'text-[#00D09C]' : 'text-rose-500'}`}>
                  {isAvailable ? '✓ User ID Available' : '✗ Already Taken'}
                </span>
              )}
            </div>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                required
                minLength={3}
                placeholder="e.g. AmanTrader, ZeroBoss99"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className={`w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-[#0E121A] border rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none transition-colors ${
                  authMode === 'SIGNUP' && isAvailable === false
                    ? 'border-rose-500'
                    : authMode === 'SIGNUP' && isAvailable === true
                    ? 'border-emerald-500'
                    : 'border-slate-200 dark:border-[#222A3A] focus:border-[#00D09C]'
                }`}
              />
            </div>
            {authMode === 'SIGNUP' && (
              <p className="text-[10px] text-slate-400 mt-1">Each User ID is unique and isolates your trading funds.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-1.5">
              Password *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="password"
                required
                minLength={4}
                placeholder="Enter password (min 4 characters)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#00D09C] hover:bg-[#00B887] text-black font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2"
          >
            {authMode === 'SIGNUP' ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create User ID & Start Trading</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Unlock & Login to Terminal</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 dark:border-[#1E2536] text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Unique User ID protects your demo capital & positions!</span>
        </div>
      </div>
    </div>
  );
};
