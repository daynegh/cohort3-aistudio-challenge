import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, ShieldCheck, Sparkles, BookOpen, MapPin, Activity } from 'lucide-react';
import { signOutUser } from '../lib/firebase';

interface NavbarProps {
  user: User | null;
  activeTab: 'editor' | 'history' | 'places';
  setActiveTab: (tab: 'editor' | 'history' | 'places') => void;
  onOpenSecurityModal: () => void;
  onOpenMonitoringModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenSecurityModal,
  onOpenMonitoringModal,
}) => {
  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              ReflectAI
            </span>
            <span className="ml-2 hidden rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 sm:inline-block">
              Gemini 3.6 Flash
            </span>
          </div>
        </div>

        {/* Center Navigation if signed in */}
        {user && (
          <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              id="nav-editor-btn"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>Reflection Workspace</span>
            </button>
            <button
              id="nav-history-btn"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4 text-slate-600" />
              <span>Past Entries</span>
            </button>
            <button
              id="nav-places-btn"
              onClick={() => setActiveTab('places')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'places'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="h-4 w-4 text-indigo-600" />
              <span>Places to Visit</span>
            </button>
          </nav>
        )}

        {/* Actions & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Monitoring Trigger */}
          <button
            id="monitoring-modal-btn"
            onClick={onOpenMonitoringModal}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="View Live Monitoring, Key Rotation Health & Logs"
          >
            <Activity className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Health & Logs</span>
          </button>

          {/* Security Architecture Trigger */}
          <button
            id="security-modal-btn"
            onClick={onOpenSecurityModal}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="View Threat Model & Security Directives"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Threat Model</span>
          </button>

          {user && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User profile'}
                  className="h-8 w-8 rounded-full border border-slate-300 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-medium text-white">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="hidden text-left md:block">
                <p className="max-w-[130px] truncate text-xs font-semibold text-slate-900 leading-tight">
                  {user.displayName || 'Authenticated User'}
                </p>
                <p className="max-w-[130px] truncate text-[10px] text-slate-500">
                  {user.email}
                </p>
              </div>
              <button
                id="signout-button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="ml-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

