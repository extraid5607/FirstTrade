'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { 
  Mail, 
  Lock, 
  LogOut, 
  UserPlus, 
  LogIn,
  Check, 
  X, 
  ShieldCheck, 
  AlertCircle,
  Eye,
  EyeOff,
  Cloud
} from 'lucide-react';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, login, register, logout } = useAuth();
  const [authMode, setAuthMode] = useState<'SIGNIN' | 'SIGNUP'>('SIGNIN');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('Please enter a valid Gmail / Email address');
      return;
    }

    if (!passwordInput || passwordInput.length < 4) {
      setAuthError('Password must be at least 4 characters');
      return;
    }

    if (authMode === 'SIGNUP') {
      if (passwordInput !== confirmPasswordInput) {
        setAuthError('Passwords do not match');
        return;
      }

      setIsLoading(true);
      const res = await register(cleanEmail, passwordInput);
      setIsLoading(false);

      if (res.success) {
        setEmailInput('');
        setPasswordInput('');
        setConfirmPasswordInput('');
        onClose();
      } else {
        setAuthError(res.message || 'Failed to create account');
      }
    } else {
      setIsLoading(true);
      const res = await login(cleanEmail, passwordInput);
      setIsLoading(false);

      if (res.success) {
        setEmailInput('');
        setPasswordInput('');
        setConfirmPasswordInput('');
        onClose();
      } else {
        setAuthError(res.message || 'Incorrect email or password');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-[#121622] rounded-2xl border border-slate-200 dark:border-[#263044] shadow-2xl overflow-hidden flex flex-col my-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#1C2333] flex items-center justify-between bg-slate-50/80 dark:bg-[#0F131C]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-[#00D09C] flex items-center justify-center border border-emerald-500/20 font-bold">
              {currentUser ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {currentUser ? 'Trading Account' : 'Account Authentication'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentUser ? 'Cloud synced profile' : 'Sign in or create account'}
              </p>
            </div>
          </div>
          {/* Prominent Cut / Hide Close Button */}
          <button 
            onClick={onClose}
            title="Hide / Close popup (Esc)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1F2738] transition-colors border border-slate-200 dark:border-[#222A3A] cursor-pointer"
          >
            <X className="w-4 h-4 text-rose-500" />
            <span>Hide</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {currentUser ? (
            /* Logged in view: Clean user card & Log Out */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2C] border border-slate-200 dark:border-[#222C3E] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${currentUser.avatarColor} text-white font-bold flex items-center justify-center text-sm shadow-sm uppercase`}>
                    {currentUser.email.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                        {currentUser.email}
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-500 flex items-center gap-1 font-semibold mt-0.5">
                      <Cloud className="w-3.5 h-3.5" />
                      Live synced across devices
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            /* Logged out view: 2 Options - Sign In & Sign Up */
            <div className="space-y-4">
              {/* Tabs: Sign In vs Sign Up */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-[#141A26] border border-slate-200 dark:border-[#1E2638] text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setAuthMode('SIGNIN'); setAuthError(''); }}
                  className={`py-1.5 rounded-lg transition-all ${
                    authMode === 'SIGNIN'
                      ? 'bg-white dark:bg-[#222B3D] text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('SIGNUP'); setAuthError(''); }}
                  className={`py-1.5 rounded-lg transition-all ${
                    authMode === 'SIGNUP'
                      ? 'bg-white dark:bg-[#222B3D] text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-1">
                    Gmail / Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. name@gmail.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      placeholder="Enter password (min 4 characters)"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authMode === 'SIGNUP' && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        placeholder="Re-enter your password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C] transition-colors"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#00D09C] hover:bg-[#00B887] disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Processing...</span>
                  ) : authMode === 'SIGNIN' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Sign Up & Claim ₹10 Lakhs</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                {authMode === 'SIGNIN' ? (
                  <span>
                    New user?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('SIGNUP'); setAuthError(''); }}
                      className="text-[#00D09C] font-bold hover:underline"
                    >
                      Sign Up
                    </button>
                  </span>
                ) : (
                  <span>
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('SIGNIN'); setAuthError(''); }}
                      className="text-[#00D09C] font-bold hover:underline"
                    >
                      Sign In
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
