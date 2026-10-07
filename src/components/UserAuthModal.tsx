'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { 
  User, 
  KeyRound, 
  LogOut, 
  UserPlus, 
  Check, 
  Trash2, 
  X, 
  ShieldCheck, 
  Lock,
  ChevronDown,
  ArrowRight
} from 'lucide-react';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, usersList, register, login, logout, deleteAccount } = useAuth();
  const [mode, setMode] = useState<'SELECT' | 'CREATE'>('SELECT');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [authError, setAuthError] = useState('');

  if (!isOpen) return null;

  const handleSelectLogin = (username: string) => {
    setSelectedUser(username);
    setAuthError('');
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    if (mode === 'CREATE') {
      const res = await register(usernameInput, passwordInput);
      if (res.success) {
        setUsernameInput('');
        setPasswordInput('');
        setSelectedUser('');
        onClose();
      } else {
        setAuthError(res.message || 'Failed to create user');
      }
    } else {
      const targetUser = selectedUser || usernameInput.trim();
      const res = await login(targetUser, passwordInput);
      if (res.success) {
        setUsernameInput('');
        setPasswordInput('');
        setSelectedUser('');
        onClose();
      } else {
        setAuthError(res.message || 'Incorrect password');
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
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">User Account & Profiles</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Switch profile or register unique account</p>
            </div>
          </div>
          {/* Prominent Cut / Hide Close Button */}
          <button 
            onClick={onClose}
            title="Hide / Close popup (Esc)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1F2738] transition-colors border border-slate-200 dark:border-[#222A3A]"
          >
            <X className="w-4 h-4 text-rose-500" />
            <span>Hide</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Current Active User Banner */}
          {currentUser && (
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-[#161D2C] border border-slate-200 dark:border-[#222C3E] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${currentUser.avatarColor} text-white font-bold flex items-center justify-center text-xs shadow-sm uppercase`}>
                  {currentUser.username.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.username}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-emerald-500/15 text-[#00D09C] border border-emerald-500/30">Active</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Isolated trade book & balance</span>
                </div>
              </div>

              <button
                onClick={() => {
                  logout();
                  setMode('SELECT');
                }}
                title="Switch User"
                className="px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch</span>
              </button>
            </div>
          )}

          {/* Sub-tabs: Select Existing vs Create New */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-[#141A26] border border-slate-200 dark:border-[#1E2638] text-xs font-semibold">
            <button
              onClick={() => { setMode('SELECT'); setAuthError(''); }}
              className={`py-1.5 rounded-lg transition-all ${
                mode === 'SELECT'
                  ? 'bg-white dark:bg-[#222B3D] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Select User ({usersList.length})
            </button>
            <button
              onClick={() => { setMode('CREATE'); setAuthError(''); setSelectedUser(''); }}
              className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                mode === 'CREATE'
                  ? 'bg-white dark:bg-[#222B3D] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ New User</span>
            </button>
          </div>

          {authError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium text-center">
              {authError}
            </div>
          )}

          {/* MODE 1: Select From Existing Users */}
          {mode === 'SELECT' && (
            <div className="space-y-3">
              <label className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">
                Choose a profile to load:
              </label>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {usersList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No other accounts yet. Click '+ New User' above.</p>
                ) : (
                  usersList.map((uname) => {
                    const isCur = currentUser?.username === uname;
                    const isSel = selectedUser === uname;
                    return (
                      <div
                        key={uname}
                        onClick={() => handleSelectLogin(uname)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isCur
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30'
                            : isSel
                            ? 'bg-slate-100 dark:bg-[#1E2536] border-[#00D09C]'
                            : 'bg-white dark:bg-[#141926] border-slate-200 dark:border-[#1E2536] hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-[#202738] flex items-center justify-center font-bold text-[11px] uppercase text-slate-700 dark:text-slate-300">
                            {uname.substring(0, 2)}
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{uname}</span>
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {isCur ? (
                            <span className="text-[10px] font-semibold text-[#00D09C] flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSelectLogin(uname)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black transition-colors"
                            >
                              Login
                            </button>
                          )}

                          {usersList.length > 1 && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete user '${uname}' and clear all their trade history?`)) {
                                  deleteAccount(uname);
                                }
                              }}
                              title="Delete user"
                              className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Password prompt if password required for selected user */}
              {selectedUser && selectedUser !== currentUser?.username && (
                <form onSubmit={handleSubmitLogin} className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1E2536]">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Password for <strong className="text-[#00D09C]">{selectedUser}</strong> (leave blank if none):
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="password"
                        placeholder="Optional Password..."
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#00D09C] hover:bg-[#00B887] text-black font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1"
                    >
                      <span>Unlock</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* MODE 2: Create New User */}
          {mode === 'CREATE' && (
            <form onSubmit={handleSubmitLogin} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                  User Name / Trader Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aman, Rahul, StrategyA..."
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                  Password (Optional)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Set optional password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#222A3A] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00D09C]"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Leave empty if you don't need a password for quick login.</p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#00D09C] hover:bg-[#00B887] text-black font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create & Login to Account</span>
              </button>
            </form>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="p-3 bg-slate-50/50 dark:bg-[#0D1017] border-t border-slate-100 dark:border-[#1A202E] text-[10px] text-slate-500 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Each user gets their own ₹10,00,000 demo capital, positions & order book!</span>
        </div>
      </div>
    </div>
  );
};
