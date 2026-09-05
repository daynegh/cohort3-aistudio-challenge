import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { subscribeToAuth } from './lib/firebase';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { EntryHistory } from './components/EntryHistory';
import { PlacesTracker } from './components/PlacesTracker';
import { ThreatModelModal } from './components/ThreatModelModal';
import { MonitoringModal } from './components/MonitoringModal';
import { JournalEntry } from './types';
import { subscribeToUserEntries, deleteJournalEntry } from './services/journalService';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'places'>('editor');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false);

  // 1. Listen for Authentication state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time subscription to user's isolated Firestore collection
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setCurrentEntry(null);
      return;
    }

    setEntriesLoading(true);
    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        setEntriesLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe to user entries:', err);
        setEntriesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSelectEntry = (entry: JournalEntry) => {
    setCurrentEntry(entry);
    setActiveTab('editor');
  };

  const handleNewEntry = () => {
    setCurrentEntry(null);
    setActiveTab('editor');
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    await deleteJournalEntry(user.uid, entryId);
    if (currentEntry?.id === entryId) {
      setCurrentEntry(null);
    }
  };

  const handleEntrySaved = (savedEntry: JournalEntry) => {
    setCurrentEntry(savedEntry);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-800 border-t-transparent" />
          <p className="text-xs font-medium text-slate-500">
            Initializing Secure Auth & Firestore...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Navigation */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onOpenMonitoringModal={() => setIsMonitoringModalOpen(true)}
      />

      {/* Main Body */}
      <main className="flex-1">
        {!user ? (
          <LandingPage onSignInSuccess={() => setActiveTab('editor')} />
        ) : activeTab === 'editor' ? (
          <JournalEditor
            user={user}
            currentEntry={currentEntry}
            onEntrySaved={handleEntrySaved}
            onNewEntry={handleNewEntry}
            onNavigateToPlaces={() => setActiveTab('places')}
          />
        ) : activeTab === 'history' ? (
          <EntryHistory
            entries={entries}
            onSelectEntry={handleSelectEntry}
            onDeleteEntry={handleDeleteEntry}
            onNewEntry={handleNewEntry}
            loading={entriesLoading}
          />
        ) : (
          <PlacesTracker user={user} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <p>
            ReflectAI • User-Isolated Cloud Firestore & Gemini 3.6 Flash Processing Engine
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMonitoringModalOpen(true)}
              className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
            >
              Live Monitoring & Key Rotation
            </button>
            <span>•</span>
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="text-slate-500 hover:text-slate-800 underline decoration-slate-300 cursor-pointer"
            >
              Threat Model & Compliance Standards
            </button>
          </div>
        </div>
      </footer>

      {/* Threat Model & Security Compliance Modal */}
      <ThreatModelModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      {/* Live Monitoring & Key Rotation Modal */}
      <MonitoringModal
        isOpen={isMonitoringModalOpen}
        onClose={() => setIsMonitoringModalOpen(false)}
      />
    </div>
  );
}

