'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { PortfolioSummary } from '@/types/trading';
import { 
  Mail, 
  Lock, 
  LogOut, 
  UserPlus, 
  LogIn,
  Check, 
  ShieldCheck, 
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Cloud,
  RotateCcw
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
  const { currentUser, login, register, logout, deleteAccount } = useAuth();

  const [authMode, setAuthMode] = useState<'SIGNIN' | 'SIGNUP'>('SIGNIN');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid Gmail / Email address (e.g. name@gmail.com)');
      return;
    }

    if (!passwordInput || passwordInput.length < 4) {
      setErrorMessage('Password must be at least 4 characters');
      return;
    }

    if (authMode === 'SIGNUP') {
      if (passwordInput !== confirmPasswordInput) {
        setErrorMessage('Passwords do not match');
        return;
      }

      setIsLoading(true);
      const res = await register(cleanEmail, passwordInput);
      setIsLoading(false);

      if (res.success) {
        setSuccessMessage('Account created successfully! Logged in.');
        setEmailInput('');
        setPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        setErrorMessage(res.message || 'Failed to create account');
      }
    } else {
      setIsLoading(true);
      const res = await login(cleanEmail, passwordInput);
      setIsLoading(false);

      if (res.success) {
        setSuccessMessage('Signed in successfully!');
        setEmailInput('');
        setPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        setErrorMessage(res.message || 'Invalid email or password');
      }
    }
  };

  // If user is LOGGED IN: Show their private portfolio, cloud sync status, and Log Out
  if (currentUser) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0B0E14] p-4 sm:p-6 transition-colors pb-24 md:pb-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Active User Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121622] border border-slate-200 dark:border-[#1E2638] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${currentUser.avatarColor} text-white font-extrabold flex items-center justify-center text-xl shadow-md uppercase`}>
                  {currentUser.email.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                      {currentUser.email}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-[#00D09C] border border-emerald-500/30 flex items-center gap-1 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      Active
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Cloud synced across Mobile & Laptop</span>
                  </div>
                </div>
              </div>

              {/* Log Out Button */}
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to log out from ${currentUser.email}?`)) {
                    logout();
                  }
                }}
                className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>

            {/* Live Margin & P&L Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-[#1A202E]">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161C28] border border-slate-200/80 dark:border-[#222A3A]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Available Margin</span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  ₹{portfolio.availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161C28] border border-slate-200/80 dark:border-[#222A3A]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total P&L Today</span>
                <span className={`text-sm sm:text-base font-mono font-bold tabular-nums ${
                  portfolio.totalUnrealizedPnL >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'
                }`}>
                  {portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}₹{portfolio.totalUnrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161C28] border border-slate-200/80 dark:border-[#222A3A] col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Account Net Value</span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  ₹{portfolio.totalAccountValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-[#1A202E]">
              <button
                onClick={() => {
                  if (window.confirm('Reset this account demo balance to ₹10,00,000 and clear all positions?')) {
                    onResetAccount();
                  }
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo Balance to ₹10 Lakhs</span>
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

          {/* Sync & Security Information */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#121622] border border-slate-200 dark:border-[#1E2638] shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Multi-Device Sync Status</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              You are signed in with <strong className="text-slate-800 dark:text-slate-200">{currentUser.email}</strong>. Any orders placed or positions held on your mobile phone or laptop sync automatically in real-time through cloud database.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is NOT LOGGED IN: Show clean Sign In / Sign Up form
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-[#0B0E14] transition-colors pb-24 md:pb-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-[#121622] rounded-3xl border border-slate-200 dark:border-[#20283A] shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00D09C] to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto text-black font-extrabold">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {authMode === 'SIGNIN' ? 'Sign In to FirstTrade' : 'Create FirstTrade Account'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            {authMode === 'SIGNIN'
              ? 'Enter your Gmail / Email and password to access your synced demo portfolio.'
              : 'Sign up with your Gmail to claim your ₹10,00,000 demo capital across mobile & laptop.'}
          </p>
        </div>

        {/* Two Options: SIGN IN and SIGN UP */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#161C28] rounded-xl border border-slate-200 dark:border-[#20283A] text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setAuthMode('SIGNIN'); setErrorMessage(''); setSuccessMessage(''); }}
            className={`py-2 rounded-lg transition-all ${
              authMode === 'SIGNIN'
                ? 'bg-white dark:bg-[#222B3D] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('SIGNUP'); setErrorMessage(''); setSuccessMessage(''); }}
            className={`py-2 rounded-lg transition-all ${
              authMode === 'SIGNUP'
                ? 'bg-white dark:bg-[#222B3D] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sign Up
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

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-1.5">
              Gmail / Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="email"
                required
                placeholder="e.g. name@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-1.5">
              Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={4}
                placeholder="Enter password (min 4 characters)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {authMode === 'SIGNUP' && (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  placeholder="Re-enter your password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C] transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#00D09C] hover:bg-[#00B887] disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {isLoading ? (
              <span>Processing...</span>
            ) : authMode === 'SIGNIN' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to Terminal</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Sign Up & Claim ₹10 Lakhs</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="text-center">
          {authMode === 'SIGNIN' ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setAuthMode('SIGNUP'); setErrorMessage(''); setSuccessMessage(''); }}
                className="text-[#00D09C] font-bold hover:underline"
              >
                Sign Up here
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setAuthMode('SIGNIN'); setErrorMessage(''); setSuccessMessage(''); }}
                className="text-[#00D09C] font-bold hover:underline"
              >
                Sign In here
              </button>
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-[#1E2536] text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <Cloud className="w-4 h-4 text-emerald-500" />
          <span>Real-time cloud sync between Mobile and Laptop</span>
        </div>
      </div>
    </div>
  );
};
