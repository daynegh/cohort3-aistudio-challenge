import React, { useState } from 'react';
import { Sparkles, Shield, Lock, Brain, ArrowRight, CheckCircle2, User } from 'lucide-react';
import { signInWithGoogle, signInAsGuest } from '../lib/firebase';

interface LandingPageProps {
  onSignInSuccess?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignInSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      if (onSignInSuccess) onSignInSuccess();
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. You can click "Continue as Guest / Try Demo" below to enter immediately.');
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Authentication encountered an issue. You can continue as Guest to test immediately.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    setAuthError(null);
    try {
      await signInAsGuest();
      if (onSignInSuccess) onSignInSuccess();
    } catch (err: any) {
      console.error('Guest sign-in error:', err);
      setAuthError(err?.message || 'Guest session could not be started.');
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center px-4">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span>User-Isolated Firestore & Gemini 3.6 Flash</span>
        </div>

        {/* Headline */}
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          A Private Space for Deep Thought & Reflection
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
          Write unfiltered thoughts, explore ideas, and converse with an empathetic AI partner.
          Your reflections are cryptographically isolated to your Google account in Cloud Firestore.
        </p>

        {/* Error notice if auth fails */}
        {authError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 text-left">
            <p className="font-semibold">Sign-In Notice</p>
            <p className="mt-1 text-xs">{authError}</p>
          </div>
        )}

        {/* Primary Auth Card */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Authenticate to Access Your Journal
              </h2>
              <p className="text-xs text-slate-500">
                Federated Google Sign-In with strict Firestore security isolation
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              id="google-signin-btn"
              onClick={handleSignIn}
              disabled={loading || isGuestLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white transition-all hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60 shadow-xs cursor-pointer"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8 0-1.3.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                  />
                </svg>
              )}
              <span>{loading ? 'Authenticating...' : 'Sign In with Google'}</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>

            <div className="relative flex items-center justify-center py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Or quick test
              </span>
            </div>

            <button
              id="guest-signin-btn"
              onClick={handleGuestSignIn}
              disabled={loading || isGuestLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all disabled:opacity-60 cursor-pointer"
            >
              {isGuestLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              ) : (
                <User className="h-4 w-4 text-indigo-600" />
              )}
              <span>{isGuestLoading ? 'Connecting guest session...' : 'Continue as Guest / Try Demo'}</span>
            </button>
          </div>

          {/* Privacy Guarantees */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Security & Privacy Architecture
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Owner-Bound Isolation:</strong> Firestore rules enforce{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">
                    request.auth.uid == userId
                  </code>
                  . Other users cannot query or inspect your records.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>No Stored Passwords:</strong> Handled securely via Google Federated Identity, preventing credential leaks.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Server-Side Gemini API Proxy:</strong> Gemini API keys are never exposed in browser network traffic.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <Brain className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Multi-Turn Reflections</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Engage in multi-turn dialogues with Gemini to unpack complex emotions, decisions, and goals.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Executive Summaries</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Auto-generate structured summaries and actionable takeaways from long journal sessions.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Shield className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Encrypted Cloud Storage</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              All entries and chat histories are permanently synced and indexed in Google Cloud Firestore.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
