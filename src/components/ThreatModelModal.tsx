import React from 'react';
import { X, ShieldCheck, Lock, Database, Server, Key } from 'lucide-react';

interface ThreatModelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThreatModelModal: React.FC<ThreatModelModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Agentic Threat Model & Security Compliance
              </h2>
              <p className="text-xs text-slate-500">
                OWASP Top 10 Web & LLM Mitigations • User Data Isolation • Cloud Run Architecture
              </p>
            </div>
          </div>
          <button
            id="close-threat-modal-btn"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Threat Summary Table (The 5 Threat Zones) */}
        <div className="mt-6 space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              The 5 Agentic Threat Zones & Countermeasures
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Threat Zone</th>
                    <th className="p-3">Specific Risk / Scenario</th>
                    <th className="p-3">Countermeasure / Mitigation</th>
                    <th className="p-3">OWASP Standard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-rose-500" />
                      1. Input Surfaces
                    </td>
                    <td className="p-3">Malicious payloads, JSON injection, XSS via journal content.</td>
                    <td className="p-3">
                      Top-level body parsing ordering, null-safe destructuring, strict string trimming, React text escaping.
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-800">A03: Injection / LLM02</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-amber-500" />
                      2. Planning & Reasoning
                    </td>
                    <td className="p-3">Indirect prompt injection attempting to leak system prompts or break persona.</td>
                    <td className="p-3">
                      Hardened system instructions enforcing pure reflection role; user inputs formatted as plain data turns.
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-800">LLM01: Prompt Injection</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-indigo-500" />
                      3. Tool Execution
                    </td>
                    <td className="p-3">Privilege escalation or unauthorized backend API misuse.</td>
                    <td className="p-3">
                      Bearer JWT authorization verification on all <code className="bg-slate-100 px-1 py-0.5 rounded">/api/gemini/*</code> routes. No arbitrary shell execution.
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-800">A01: Broken Access Control</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-emerald-500" />
                      4. Memory & State
                    </td>
                    <td className="p-3">Cross-user reflection reads, unauthorized session access.</td>
                    <td className="p-3">
                      Owner-bound Firestore path validation (<code className="bg-slate-100 px-1 py-0.5 rounded">request.auth.uid == userId</code>). Zero insecure defaults.
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-800">A01 & Strict Isolation</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                      5. Inter-System Comm
                    </td>
                    <td className="p-3">Gemini API key exposure in browser client bundles or network requests.</td>
                    <td className="p-3">
                      Server-side reverse proxy; keys stored exclusively in server environment / Secret Manager.
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-800">A02: Cryptographic Failures</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Security Rules in Firestore */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-600" />
              <span>Deployed Firestore Security Rules</span>
            </h4>
            <pre className="mt-2 text-[11px] font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /places/{placeId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}`}
            </pre>
          </div>

          {/* Resilient Fallback Ladder */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Server className="h-4 w-4 text-indigo-600" />
              <span>Gemini Model Resilience & Fallback Ladder</span>
            </h4>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <span className="text-[10px] font-bold text-indigo-700 uppercase">Primary</span>
                <p className="font-mono text-slate-900 font-semibold mt-0.5">gemini-3.6-flash</p>
                <p className="text-[10px] text-slate-500 mt-1">High intelligence, low latency</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Tier 2 Fallback</span>
                <p className="font-mono text-slate-900 font-semibold mt-0.5">gemini-3.1-flash-lite</p>
                <p className="text-[10px] text-slate-500 mt-1">Maximum throughput resilience</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Tier 3 Fallback</span>
                <p className="font-mono text-slate-900 font-semibold mt-0.5">gemini-flash-latest</p>
                <p className="text-[10px] text-slate-500 mt-1">Dynamic alias recovery</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Tier 4 Fallback</span>
                <p className="font-mono text-slate-900 font-semibold mt-0.5">gemini-3.7-flash</p>
                <p className="text-[10px] text-slate-500 mt-1">Deep reasoning backup</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Close Security View
          </button>
        </div>
      </div>
    </div>
  );
};
